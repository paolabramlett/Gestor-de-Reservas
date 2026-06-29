"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function reasignarHabitacionAction(
  reservaId: string,
  nuevaHabitacionId: string
): Promise<{ error?: string }> {
  const usuario = await getCurrentUsuario();
  if (!usuario) return { error: "No autorizado" };

  // Verify ownership
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    include: { asignacion: true, tipoDeHabitacion: true },
  });
  if (!reserva) return { error: "Reserva no encontrada" };

  const nuevaHabitacion = await prisma.habitacion.findFirst({
    where: { id: nuevaHabitacionId, propiedadId: usuario.propiedadId },
  });
  if (!nuevaHabitacion) return { error: "Habitación no encontrada" };

  if (nuevaHabitacion.tipoDeHabitacionId !== reserva.tipoDeHabitacionId) {
    return { error: "Solo se puede reasignar a habitaciones del mismo tipo" };
  }

  // Check for conflicts in target room
  const conflicto = await prisma.reserva.findFirst({
    where: {
      id: { not: reservaId },
      estado: { notIn: ["CANCELADA", "NO_SHOW"] },
      asignacion: { habitacionId: nuevaHabitacionId },
      fechaIngreso: { lt: reserva.fechaSalida },
      fechaSalida: { gt: reserva.fechaIngreso },
    },
  });
  if (conflicto) {
    return { error: "La habitación ya tiene una reserva en esas fechas" };
  }

  // Upsert assignment
  if (reserva.asignacion) {
    await prisma.asignacionDeHabitacion.update({
      where: { reservaId },
      data: { habitacionId: nuevaHabitacionId },
    });
  } else {
    await prisma.asignacionDeHabitacion.create({
      data: { reservaId, habitacionId: nuevaHabitacionId },
    });
  }

  revalidatePath("/panel/calendario");
  return {};
}

export async function cambiarFechasAction(
  reservaId: string,
  nuevaFechaIngreso: string,
  nuevaFechaSalida: string
): Promise<{ error?: string }> {
  const usuario = await getCurrentUsuario();
  if (!usuario) return { error: "No autorizado" };

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    include: { asignacion: true },
  });
  if (!reserva) return { error: "Reserva no encontrada" };

  const ingreso = new Date(nuevaFechaIngreso + "T12:00:00");
  const salida = new Date(nuevaFechaSalida + "T12:00:00");

  if (ingreso >= salida) return { error: "La fecha de salida debe ser posterior al ingreso" };

  // Check conflicts if assigned to a room
  if (reserva.asignacion) {
    const conflicto = await prisma.reserva.findFirst({
      where: {
        id: { not: reservaId },
        estado: { notIn: ["CANCELADA", "NO_SHOW"] },
        asignacion: { habitacionId: reserva.asignacion.habitacionId },
        fechaIngreso: { lt: salida },
        fechaSalida: { gt: ingreso },
      },
    });
    if (conflicto) {
      return { error: "Hay otra reserva en esas fechas para la misma habitación" };
    }
  }

  await prisma.reserva.update({
    where: { id: reservaId },
    data: { fechaIngreso: ingreso, fechaSalida: salida },
  });

  revalidatePath("/panel/calendario");
  return {};
}
