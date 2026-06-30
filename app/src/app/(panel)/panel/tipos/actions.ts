"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModalidadTarifa } from "@prisma/client";
import { redirect } from "next/navigation";

function parseTipoFormData(formData: FormData) {
  return {
    nombre: formData.get("nombre") as string,
    descripcion: (formData.get("descripcion") as string) || null,
    capacidadMin: Number(formData.get("capacidadMin")),
    capacidadMax: Number(formData.get("capacidadMax")),
    tarifaBasePrice: Number(formData.get("tarifaBasePrice")),
    tarifaBaseModalidad: formData.get("tarifaBaseModalidad") as ModalidadTarifa,
    suplementoPorPersona: Number(formData.get("suplementoPorPersona")) || null,
    fotos: formData.getAll("fotos").map(String).filter(Boolean),
    amenidades: formData.getAll("amenidades").map(String).filter(Boolean),
  };
}

export async function crearTipoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  await prisma.tipoDeHabitacion.create({
    data: {
      propiedadId: usuario.propiedadId,
      ...parseTipoFormData(formData),
    },
  });

  redirect("/panel/tipos?success=" + encodeURIComponent("Tipo creado"));
}

export async function actualizarTipoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const id = formData.get("id") as string;

  await prisma.tipoDeHabitacion.updateMany({
    where: { id, propiedadId: usuario.propiedadId },
    data: {
      ...parseTipoFormData(formData),
      activo: formData.get("activo") === "true",
    },
  });

  redirect("/panel/tipos?success=" + encodeURIComponent("Cambios guardados"));
}
