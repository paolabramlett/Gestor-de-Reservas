"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export async function actualizarPropiedadAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  await prisma.propiedad.update({
    where: { id: usuario.propiedadId },
    data: {
      nombre: formData.get("nombre") as string,
      descripcion: (formData.get("descripcion") as string) || null,
      telefono: (formData.get("telefono") as string) || null,
      email: (formData.get("email") as string) || null,
      direccion: (formData.get("direccion") as string) || null,
      colorPrimario: (formData.get("colorPrimario") as string) || null,
    },
  });

  redirect("/panel/configuracion?guardado=1");
}
