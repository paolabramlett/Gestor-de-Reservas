"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function crearHabitacionAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const numero = formData.get("numero") as string;

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
      tipoDeHabitacionId: formData.get("tipoDeHabitacionId") as string,
      numero,
      descripcion: (formData.get("descripcion") as string) || null,
    },
  });

  redirect("/panel/habitaciones");
}

export async function actualizarHabitacionAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const id = formData.get("id") as string;
  const numero = formData.get("numero") as string;

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
      tipoDeHabitacionId: formData.get("tipoDeHabitacionId") as string,
      numero,
      descripcion: (formData.get("descripcion") as string) || null,
      activa: formData.get("activa") === "true",
    },
  });

  redirect("/panel/habitaciones");
}
