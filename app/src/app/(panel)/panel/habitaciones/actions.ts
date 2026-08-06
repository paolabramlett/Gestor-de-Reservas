"use server";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function crearHabitacionAction(formData: FormData) {
  const usuario = await requireAdmin();

  const numero = formData.get("numero") as string;
  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: tipoDeHabitacionId, propiedadId: usuario.propiedadId },
    select: { id: true },
  });
  if (!tipo) throw new Error("Tipo de habitación no encontrado");

  // Task 4.4: validar unicidad del número
  const existente = await prisma.habitacion.findUnique({
    where: { propiedadId_numero: { propiedadId: usuario.propiedadId, numero } },
  });
  if (existente) {
    throw new Error(`Ya existe una habitación con número "${numero}"`);
  }

  await prisma.habitacion.create({
    data: {
      propiedadId: usuario.propiedadId,
      tipoDeHabitacionId,
      numero,
      descripcion: (formData.get("descripcion") as string) || null,
    },
  });

  redirect("/panel/habitaciones?success=" + encodeURIComponent("Cambios guardados"));
}

export async function actualizarHabitacionAction(formData: FormData) {
  const usuario = await requireAdmin();

  const id = formData.get("id") as string;
  const numero = formData.get("numero") as string;
  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: tipoDeHabitacionId, propiedadId: usuario.propiedadId },
    select: { id: true },
  });
  if (!tipo) throw new Error("Tipo de habitación no encontrado");

  // Task 4.4: validar unicidad excluyendo la habitación actual
  const existente = await prisma.habitacion.findFirst({
    where: {
      propiedadId: usuario.propiedadId,
      numero,
      NOT: { id },
    },
  });
  if (existente) {
    throw new Error(`Ya existe una habitación con número "${numero}"`);
  }

  await prisma.habitacion.updateMany({
    where: { id, propiedadId: usuario.propiedadId },
    data: {
      tipoDeHabitacionId,
      numero,
      descripcion: (formData.get("descripcion") as string) || null,
      activa: formData.get("activa") === "true",
    },
  });

  redirect("/panel/habitaciones?success=" + encodeURIComponent("Cambios guardados"));
}
