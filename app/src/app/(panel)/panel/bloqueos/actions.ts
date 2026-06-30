"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

// ─── BloqueoDeHabitacion (5.5) ───────────────────────────────────────────────

export async function crearBloqueoHabitacionAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  await prisma.bloqueoDeHabitacion.create({
    data: {
      habitacionId: formData.get("habitacionId") as string,
      propiedadId: usuario.propiedadId,
      fechaInicio: new Date(formData.get("fechaInicio") as string),
      fechaFin: new Date(formData.get("fechaFin") as string),
      motivo: (formData.get("motivo") as string) || null,
    },
  });

  redirect("/panel/bloqueos?success=" + encodeURIComponent("Cambios guardados"));
}

export async function eliminarBloqueoHabitacionAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

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
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  await prisma.bloqueoDetipo.create({
    data: {
      tipoDeHabitacionId: formData.get("tipoDeHabitacionId") as string,
      propiedadId: usuario.propiedadId,
      fechaInicio: new Date(formData.get("fechaInicio") as string),
      fechaFin: new Date(formData.get("fechaFin") as string),
      motivo: (formData.get("motivo") as string) || null,
    },
  });

  redirect("/panel/bloqueos?success=" + encodeURIComponent("Cambios guardados"));
}

export async function eliminarBloqueoTipoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  await prisma.bloqueoDetipo.deleteMany({
    where: {
      id: formData.get("id") as string,
      propiedadId: usuario.propiedadId,
    },
  });

  redirect("/panel/bloqueos?success=" + encodeURIComponent("Cambios guardados"));
}
