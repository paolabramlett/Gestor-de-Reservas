"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { RolUsuario } from "@prisma/client";

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function crearHotelAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const nombre = (formData.get("nombre") as string)?.trim();
  const slugInput = (formData.get("slug") as string)?.trim();
  const telefono = (formData.get("telefono") as string)?.trim() || null;
  const email = (formData.get("email") as string)?.trim() || null;

  if (!nombre || nombre.length < 2) {
    redirect("/setup?error=nombre");
  }

  // Verificar que el usuario no tenga ya un hotel
  const yaExiste = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId },
  });
  if (yaExiste) redirect("/panel");

  // Generar slug único
  const baseSlug = slugInput || generarSlug(nombre);
  let slug = baseSlug;
  let intento = 0;
  while (await prisma.propiedad.findUnique({ where: { slug } })) {
    intento++;
    slug = `${baseSlug}-${intento}`;
  }

  // Crear propiedad y usuario en una transacción
  const propiedad = await prisma.$transaction(async (tx) => {
    const p = await tx.propiedad.create({
      data: {
        clerkOrgId: userId, // usamos userId como org ID en el piloto
        slug,
        nombre,
        telefono,
        email,
      },
    });
    await tx.usuarioPropiedad.create({
      data: {
        clerkUserId: userId,
        propiedadId: p.id,
        rol: RolUsuario.ADMIN,
      },
    });
    return p;
  });

  redirect(`/panel?setup=ok`);
}
