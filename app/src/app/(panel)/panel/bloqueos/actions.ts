"use server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// ─── BloqueoDeHabitacion (5.5) ───────────────────────────────────────────────

export async function crearBloqueoHabitacionAction(formData: FormData) {
  const usuario = await requireAdmin();
  const habitacionId = formData.get("habitacionId") as string;

  const habitacion = await prisma.habitacion.findFirst({
    where: { id: habitacionId, propiedadId: usuario.propiedadId },
    select: { id: true },
  });
  if (!habitacion) throw new Error("Habitación no encontrada");

  await prisma.bloqueoDeHabitacion.create({
    data: {
      habitacionId,
      propiedadId: usuario.propiedadId,
      fechaInicio: new Date(formData.get("fechaInicio") as string),
      fechaFin: new Date(formData.get("fechaFin") as string),
      motivo: (formData.get("motivo") as string) || null,
    },
  });

  redirect("/panel/bloqueos?success=" + encodeURIComponent("Cambios guardados"));
}

export async function eliminarBloqueoHabitacionAction(formData: FormData) {
  const usuario = await requireAdmin();

  await prisma.bloqueoDeHabitacion.deleteMany({
    where: {
      id: formData.get("id") as string,
      propiedadId: usuario.propiedadId,
    },
  });

  redirect("/panel/bloqueos?success=" + encodeURIComponent("Cambios guardados"));
}

// ─── BloqueoDetipo (5.6) ─────────────────────────────────────────────────────

export async function crearBloqueoTipoAction(formData: FormData) {
  const usuario = await requireAdmin();
  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: tipoDeHabitacionId, propiedadId: usuario.propiedadId },
    select: { id: true },
  });
  if (!tipo) throw new Error("Tipo de habitación no encontrado");

  await prisma.bloqueoDetipo.create({
    data: {
      tipoDeHabitacionId,
      propiedadId: usuario.propiedadId,
      fechaInicio: new Date(formData.get("fechaInicio") as string),
      fechaFin: new Date(formData.get("fechaFin") as string),
      motivo: (formData.get("motivo") as string) || null,
    },
  });

  redirect("/panel/bloqueos?success=" + encodeURIComponent("Cambios guardados"));
}

export async function eliminarBloqueoTipoAction(formData: FormData) {
  const usuario = await requireAdmin();

  await prisma.bloqueoDetipo.deleteMany({
    where: {
      id: formData.get("id") as string,
      propiedadId: usuario.propiedadId,
    },
  });

  redirect("/panel/bloqueos?success=" + encodeURIComponent("Cambios guardados"));
}
