"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearReservaManual, crearReservaConLinkDePago } from "@/lib/negocio/reservas";
import { EstadoDePago, EstadoReserva, TipoEspecialReserva } from "@prisma/client";
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
  const from = formData.get("from") as string;
  const tipoEspecialRaw = formData.get("tipoEspecial") as string;
  const tipoEspecial = tipoEspecialRaw ? (tipoEspecialRaw as TipoEspecialReserva) : null;
  const montoAnticipoRaw = formData.get("montoAnticipo") as string;
  const montoAnticipo =
    estadoDePago === EstadoDePago.ANTICIPO_PAGADO && montoAnticipoRaw
      ? Number(montoAnticipoRaw)
      : null;
  const totalOverrideRaw = formData.get("totalOverride") as string;
  const totalOverride = totalOverrideRaw ? Number(totalOverrideRaw) : null;

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
    tipoEspecial,
    montoAnticipo,
    totalOverride,
  });

  if (from === "calendario") {
    const mes = fechaIngreso.getMonth() + 1;
    const año = fechaIngreso.getFullYear();
    redirect(`/panel/calendario?mes=${mes}&año=${año}&success=${encodeURIComponent("Reserva creada")}`);
  }
  redirect(`/panel/reservas/${reserva.id}?success=${encodeURIComponent("Reserva creada")}`);
}

export async function crearReservaConPagoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;
  const telefono = (formData.get("telefono") as string) || undefined;
  const fechaIngreso = new Date(formData.get("fechaIngreso") as string);
  const fechaSalida = new Date(formData.get("fechaSalida") as string);
  const numPersonas = Number(formData.get("numPersonas"));
  const notas = (formData.get("notas") as string) || undefined;
  const from = formData.get("from") as string;
  const tipoEspecialRaw = formData.get("tipoEspecial") as string;
  const tipoEspecial = tipoEspecialRaw ? (tipoEspecialRaw as TipoEspecialReserva) : null;
  const totalOverrideRaw = formData.get("totalOverride") as string;
  const totalOverride = totalOverrideRaw ? Number(totalOverrideRaw) : null;
  const montoCobrar = Number(formData.get("montoCobrar") as string);
  const esPagoCompleto = formData.get("esPagoCompleto") === "true";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const reserva = await crearReservaConLinkDePago({
    propiedadId: usuario.propiedadId,
    tipoDeHabitacionId,
    nombre,
    email,
    telefono,
    fechaIngreso,
    fechaSalida,
    numPersonas,
    notas,
    tipoEspecial,
    totalOverride,
    montoCobrar,
    esPagoCompleto,
    baseUrl,
  });

  if (from === "calendario") {
    const mes = fechaIngreso.getMonth() + 1;
    const año = fechaIngreso.getFullYear();
    redirect(`/panel/calendario?mes=${mes}&año=${año}&success=${encodeURIComponent("Link de pago enviado al huésped")}`);
  }
  redirect(`/panel/reservas/${reserva.id}?success=${encodeURIComponent("Link de pago enviado al huésped")}`);
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

  const totalOverrideRaw = formData.get("totalOverride") as string;
  const totalOverride = totalOverrideRaw ? Number(totalOverrideRaw) : null;

  let total: number;
  let desglose: unknown;

  if (reserva.tipoEspecial === "CORTESIA") {
    total = 0;
    desglose = {};
  } else if (
    (reserva.tipoEspecial === "PRECIO_ACORDADO" || reserva.tipoEspecial === "PROMOCION") &&
    totalOverride == null
  ) {
    // Keep existing agreed price if user didn't supply a new one
    total = Number(reserva.totalMxn);
    desglose = reserva.desglosePorNoche;
  } else if (totalOverride != null) {
    total = totalOverride;
    desglose = {};
  } else {
    const result = await calcularTotalReserva(tipoDeHabitacionId, fechaIngreso, fechaSalida, numPersonas);
    total = Number(result.total);
    desglose = result.desglose;
  }

  // Check if this huesped record is shared with other reservations
  const otrasReservasConMismoHuesped = await prisma.reserva.count({
    where: { huespedId: reserva.huespedId, id: { not: reservaId } },
  });

  await prisma.$transaction(async (tx) => {
    let huespedId = reserva.huespedId;

    if (otrasReservasConMismoHuesped > 0) {
      // Create a new huesped record to avoid affecting other reservations
      const nuevoHuesped = await tx.huesped.create({
        data: { nombre, email, telefono },
      });
      huespedId = nuevoHuesped.id;
    } else {
      await tx.huesped.update({
        where: { id: reserva.huespedId },
        data: { nombre, email, telefono },
      });
    }

    await tx.reserva.update({
      where: { id: reservaId },
      data: {
        tipoDeHabitacionId,
        fechaIngreso,
        fechaSalida,
        numPersonas,
        totalMxn: total,
        desglosePorNoche: desglose as import("@prisma/client").Prisma.InputJsonValue,
        huespedId,
      },
    });

    if (tipoChanged && reserva.asignacion) {
      await tx.asignacionDeHabitacion.delete({ where: { reservaId } });
    }
  });

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
