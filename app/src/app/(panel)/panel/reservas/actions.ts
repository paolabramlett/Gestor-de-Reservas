"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearReservaManual } from "@/lib/negocio/reservas";
import { EstadoDePago, EstadoReserva } from "@prisma/client";
import { redirect } from "next/navigation";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { verificarDisponibilidadAtómica } from "@/lib/negocio/disponibilidad";

export async function crearReservaManualAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;
  const telefono = (formData.get("telefono") as string) || undefined;
  const fechaIngreso = new Date(formData.get("fechaIngreso") as string);
  const fechaSalida = new Date(formData.get("fechaSalida") as string);
  const numPersonas = Number(formData.get("numPersonas"));
  const estadoDePago = (formData.get("estadoDePago") as EstadoDePago) || EstadoDePago.PENDIENTE;
  const notas = (formData.get("notas") as string) || undefined;

  const reserva = await crearReservaManual({
    propiedadId: usuario.propiedadId,
    tipoDeHabitacionId,
    nombre,
    email,
    telefono,
    fechaIngreso,
    fechaSalida,
    numPersonas,
    estadoDePago,
    notas,
  });

  redirect(`/panel/reservas/${reserva.id}?success=${encodeURIComponent("Reserva creada")}`);
}

export async function asignarHabitacionAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const habitacionId = formData.get("habitacionId") as string;

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
  });
  if (!reserva) throw new Error("Reserva no encontrada");

  await prisma.asignacionDeHabitacion.upsert({
    where: { reservaId },
    update: { habitacionId },
    create: { reservaId, habitacionId },
  });

  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Habitación asignada")}`);
}

export async function actualizarPagoYNotasAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const estadoDePago = formData.get("estadoDePago") as EstadoDePago;
  const notas = (formData.get("notas") as string) || undefined;
  const montoAnticipoRaw = formData.get("montoAnticipo") as string;
  const montoAnticipo =
    estadoDePago === EstadoDePago.ANTICIPO_PAGADO && montoAnticipoRaw
      ? Number(montoAnticipoRaw)
      : null;

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    include: { pagoManual: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");

  await prisma.pagoManual.upsert({
    where: { reservaId },
    update: { estadoDePago, notas, montoAnticipo },
    create: { reservaId, estadoDePago, notas, montoAnticipo },
  });

  redirect(`/panel/reservas/${reservaId}`);
}

export async function actualizarDatosReservaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const fechaIngreso = new Date(formData.get("fechaIngreso") as string);
  const fechaSalida = new Date(formData.get("fechaSalida") as string);
  const numPersonas = Number(formData.get("numPersonas"));
  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;
  const telefono = (formData.get("telefono") as string) || null;

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    include: { asignacion: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");

  // Validate tipo belongs to this propiedad
  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: tipoDeHabitacionId, propiedadId: usuario.propiedadId },
  });
  if (!tipo) redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("Tipo de habitación no válido")}`);

  if (fechaIngreso >= fechaSalida)
    redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("La fecha de salida debe ser posterior al ingreso")}`);

  const tipoChanged = tipoDeHabitacionId !== reserva.tipoDeHabitacionId;

  // Conflict check: only if same tipo AND same assigned room
  if (reserva.asignacion && !tipoChanged) {
    const conflicto = await prisma.reserva.findFirst({
      where: {
        id: { not: reservaId },
        estado: { notIn: ["CANCELADA", "NO_SHOW"] },
        asignacion: { habitacionId: reserva.asignacion.habitacionId },
        fechaIngreso: { lt: fechaSalida },
        fechaSalida: { gt: fechaIngreso },
      },
    });
    if (conflicto)
      redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("Las nuevas fechas entran en conflicto con otra reserva en la misma habitación")}`);
  }

  const { total, desglose } = await calcularTotalReserva(
    tipoDeHabitacionId,
    fechaIngreso,
    fechaSalida,
    numPersonas
  );

  await prisma.$transaction([
    prisma.reserva.update({
      where: { id: reservaId },
      data: {
        tipoDeHabitacionId,
        fechaIngreso,
        fechaSalida,
        numPersonas,
        totalMxn: total,
        desglosePorNoche: desglose,
      },
    }),
    prisma.huesped.update({
      where: { id: reserva.huespedId },
      data: { nombre, email, telefono },
    }),
    // If tipo changed, clear room assignment (it belongs to the old tipo)
    ...(tipoChanged && reserva.asignacion
      ? [prisma.asignacionDeHabitacion.delete({ where: { reservaId } })]
      : []),
  ]);

  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Pago guardado")}`);
}

export async function actualizarEstadoReservaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const estado = formData.get("estado") as EstadoReserva;

  await prisma.reserva.updateMany({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    data: { estado },
  });

  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Reserva actualizada")}`);
}

export async function calcularTotalPreviewAction(
  tipoDeHabitacionId: string,
  fechaIngreso: string,
  fechaSalida: string,
  numPersonas: number
): Promise<{ total: number; error?: string }> {
  try {
    const { total } = await calcularTotalReserva(
      tipoDeHabitacionId,
      new Date(fechaIngreso),
      new Date(fechaSalida),
      numPersonas
    );
    return { total: Number(total) };
  } catch {
    return { total: 0, error: "Error calculando tarifa" };
  }
}

export async function verificarDisponibilidadAction(
  tipoDeHabitacionId: string,
  fechaIngreso: string,
  fechaSalida: string
): Promise<{ disponible: boolean }> {
  const disponible = await verificarDisponibilidadAtómica(
    tipoDeHabitacionId,
    new Date(fechaIngreso),
    new Date(fechaSalida)
  );
  return { disponible };
}
