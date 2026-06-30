"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModalidadTarifa } from "@prisma/client";
import { redirect } from "next/navigation";

export async function crearTipoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  await prisma.tipoDeHabitacion.create({
    data: {
      propiedadId: usuario.propiedadId,
      nombre: formData.get("nombre") as string,
      descripcion: (formData.get("descripcion") as string) || null,
      capacidadMin: Number(formData.get("capacidadMin")),
      capacidadMax: Number(formData.get("capacidadMax")),
      tarifaBasePrice: Number(formData.get("tarifaBasePrice")),
      tarifaBaseModalidad: formData.get("tarifaBaseModalidad") as ModalidadTarifa,
      suplementoPorPersona: Number(formData.get("suplementoPorPersona")) || null,
    },
  });

  redirect("/panel/tipos?success=" + encodeURIComponent("Cambios guardados"));
}

export async function actualizarTipoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const id = formData.get("id") as string;

  await prisma.tipoDeHabitacion.updateMany({
    where: { id, propiedadId: usuario.propiedadId },
    data: {
      nombre: formData.get("nombre") as string,
      descripcion: (formData.get("descripcion") as string) || null,
      capacidadMin: Number(formData.get("capacidadMin")),
      capacidadMax: Number(formData.get("capacidadMax")),
      tarifaBasePrice: Number(formData.get("tarifaBasePrice")),
      tarifaBaseModalidad: formData.get("tarifaBaseModalidad") as ModalidadTarifa,
      suplementoPorPersona: Number(formData.get("suplementoPorPersona")) || null,
      activo: formData.get("activo") === "true",
    },
  });

  redirect("/panel/tipos?success=" + encodeURIComponent("Cambios guardados"));
}
