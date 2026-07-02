import { prisma } from "@/lib/prisma";
import { Prisma, OrigenReserva, EstadoReserva, EstadoDePago, TipoEspecialReserva } from "@prisma/client";
import { ulid } from "ulid";
import { calcularTotalReserva } from "./tarifas";
import { verificarDisponibilidadAtómica } from "./disponibilidad";
import { enviarConfirmacion, enviarAlertaEquipo } from "@/lib/emails";

export function generarCodigoReserva(): string {
  const id = ulid();
  // Formato legible: RES-XXXX-XXXX (últimos 8 chars del ULID)
  return `RES-${id.slice(-8, -4)}-${id.slice(-4)}`;
}

type CrearReservaOnlineInput = {
  propiedadId: string;
  tipoDeHabitacionId: string;
  nombre: string;
  email: string;
  telefono?: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  numPersonas: number;
  stripePaymentIntentId: string;
};

export async function crearReservaOnline(input: CrearReservaOnlineInput) {
  const { total, desglose } = await calcularTotalReserva(
    input.tipoDeHabitacionId,
    input.fechaIngreso,
    input.fechaSalida,
    input.numPersonas
  );

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Verificar disponibilidad dentro de la transacción
    const disponible = await verificarDisponibilidadAtómica(
      input.tipoDeHabitacionId,
      input.fechaIngreso,
      input.fechaSalida
    );

    if (!disponible) {
      throw new Error("SIN_DISPONIBILIDAD");
    }

    // Idempotencia: verificar payment_intent duplicado
    const existente = await tx.reserva.findUnique({
      where: { stripePaymentIntentId: input.stripePaymentIntentId },
    });
    if (existente) return existente;

    // Crear o actualizar Huésped — siempre usar el nombre que el cliente proporcionó
    const huespedExistente = await tx.huesped.findFirst({ where: { email: input.email } });
    const huesped = huespedExistente
      ? await tx.huesped.update({
          where: { id: huespedExistente.id },
          data: { nombre: input.nombre, telefono: input.telefono ?? undefined },
        })
      : await tx.huesped.create({
          data: { nombre: input.nombre, email: input.email, telefono: input.telefono },
        });

    return tx.reserva.create({
      data: {
        codigoReserva: generarCodigoReserva(),
        propiedadId: input.propiedadId,
        tipoDeHabitacionId: input.tipoDeHabitacionId,
        huespedId: huesped.id,
        nombreHuesped: input.nombre,
        origen: OrigenReserva.ONLINE,
        estado: EstadoReserva.CONFIRMADA,
        fechaIngreso: input.fechaIngreso,
        fechaSalida: input.fechaSalida,
        numPersonas: input.numPersonas,
        totalMxn: total,
        desglosePorNoche: desglose,
        stripePaymentIntentId: input.stripePaymentIntentId,
      },
      include: { huesped: true, tipoDeHabitacion: true, propiedad: true },
    });
  });
}

type CrearReservaManualInput = {
  propiedadId: string;
  tipoDeHabitacionId: string;
  nombre: string;
  email: string;
  telefono?: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  numPersonas: number;
  estadoDePago?: EstadoDePago;
  montoAnticipo?: number | null;
  notas?: string;
  tipoEspecial?: TipoEspecialReserva | null;
  totalOverride?: number | null; // precio acordado por el usuario
};

export async function crearReservaManual(input: CrearReservaManualInput) {
  const { total: totalCalculado, desglose } = await calcularTotalReserva(
    input.tipoDeHabitacionId,
    input.fechaIngreso,
    input.fechaSalida,
    input.numPersonas
  );

  // Si hay precio acordado/cortesía, usar ese total; si es cortesía sin precio, 0
  const total =
    input.totalOverride != null
      ? input.totalOverride
      : input.tipoEspecial === "CORTESIA"
      ? 0
      : totalCalculado;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const huespedExistente = await tx.huesped.findFirst({ where: { email: input.email } });
    const huesped = huespedExistente
      ? await tx.huesped.update({
          where: { id: huespedExistente.id },
          data: { nombre: input.nombre, telefono: input.telefono ?? undefined },
        })
      : await tx.huesped.create({
          data: { nombre: input.nombre, email: input.email, telefono: input.telefono },
        });

    const reserva = await tx.reserva.create({
      data: {
        codigoReserva: generarCodigoReserva(),
        propiedadId: input.propiedadId,
        tipoDeHabitacionId: input.tipoDeHabitacionId,
        huespedId: huesped.id,
        nombreHuesped: input.nombre,
        origen: OrigenReserva.MANUAL,
        estado: EstadoReserva.CONFIRMADA,
        fechaIngreso: input.fechaIngreso,
        fechaSalida: input.fechaSalida,
        numPersonas: input.numPersonas,
        totalMxn: total,
        desglosePorNoche: desglose,
        tipoEspecial: input.tipoEspecial ?? null,
        pagoManual: {
          create: {
            estadoDePago: input.estadoDePago ?? EstadoDePago.PENDIENTE,
            montoAnticipo: input.montoAnticipo ?? null,
            notas: input.notas,
          },
        },
      },
      include: { huesped: true, tipoDeHabitacion: true, propiedad: true, pagoManual: true },
    });

    return reserva;
  }).then(async (reserva) => {
    // 11.5 + 11.8: emails confirmación y alerta equipo (fuera de la tx para no bloquearla)
    const emailParams = {
      codigoReserva: reserva.codigoReserva,
      nombreHuesped: reserva.huesped.nombre,
      nombreHotel: reserva.propiedad.nombre,
      tipoHabitacion: reserva.tipoDeHabitacion.nombre,
      fechaIngreso: reserva.fechaIngreso,
      fechaSalida: reserva.fechaSalida,
      numPersonas: reserva.numPersonas,
      totalMxn: Number(reserva.totalMxn),
      colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
    };

    await Promise.allSettled([
      enviarConfirmacion({ emailHuesped: reserva.huesped.email, ...emailParams }),
      reserva.propiedad.email
        ? enviarAlertaEquipo({
            emailEquipo: reserva.propiedad.email,
            emailHuesped: reserva.huesped.email,
            telefonoHuesped: reserva.huesped.telefono ?? undefined,
            origen: "MANUAL",
            ...emailParams,
          })
        : Promise.resolve(),
    ]);

    return reserva;
  });
}
