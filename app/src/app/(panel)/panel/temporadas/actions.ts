"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModalidadTarifa } from "@prisma/client";
import { redirect } from "next/navigation";

async function verificarSolapamiento(
  propiedadId: string,
  tipoDeHabitacionId: string,
  fechaInicio: Date,
  fechaFin: Date,
  excludeId?: string
): Promise<boolean> {
  const solapada = await prisma.temporada.findFirst({
    where: {
      propiedadId,
      tipoDeHabitacionId,
      NOT: excludeId ? { id: excludeId } : undefined,
      fechaInicio: { lte: fechaFin },
      fechaFin: { gte: fechaInicio },
    },
  });
  return !!solapada;
}

export async function crearTemporadaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const fechaInicio = new Date(formData.get("fechaInicio") as string);
  const fechaFin = new Date(formData.get("fechaFin") as string);

  // Task 4.6: validar solapamiento
  const solapada = await verificarSolapamiento(
    usuario.propiedadId,
    tipoDeHabitacionId,
    fechaInicio,
    fechaFin
  );
  if (solapada) {
    throw new Error("Las fechas se solapan con una temporada existente para ese tipo de habitación");
  }

  await prisma.temporada.create({
    data: {
      propiedadId: usuario.propiedadId,
      tipoDeHabitacionId,
      nombre: formData.get("nombre") as string,
      fechaInicio,
      fechaFin,
      precio: Number(formData.get("precio")),
      modalidad: formData.get("modalidad") as ModalidadTarifa,
    },
  });

  redirect("/panel/temporadas");
}

export async function actualizarTemporadaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const id = formData.get("id") as string;
  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const fechaInicio = new Date(formData.get("fechaInicio") as string);
  const fechaFin = new Date(formData.get("fechaFin") as string);

  const solapada = await verificarSolapamiento(
    usuario.propiedadId,
    tipoDeHabitacionId,
    fechaInicio,
    fechaFin,
    id
  );
  if (solapada) {
    throw new Error("Las fechas se solapan con una temporada existente para ese tipo de habitación");
  }

  await prisma.temporada.updateMany({
    where: { id, propiedadId: usuario.propiedadId },
    data: {
      tipoDeHabitacionId,
      nombre: formData.get("nombre") as string,
      fechaInicio,
      fechaFin,
      precio: Number(formData.get("precio")),
      modalidad: formData.get("modalidad") as ModalidadTarifa,
    },
  });

  redirect("/panel/temporadas");
}

export async function eliminarTemporadaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const id = formData.get("id") as string;
  await prisma.temporada.deleteMany({
    where: { id, propiedadId: usuario.propiedadId },
  });

  redirect("/panel/temporadas");
}
