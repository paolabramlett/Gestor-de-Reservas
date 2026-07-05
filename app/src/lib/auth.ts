import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";
import { RolUsuario } from "@prisma/client";

export type { RolUsuario };

export async function getCurrentUsuario() {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  // orderBy creadoEn desc: si el usuario pertenece a más de un hotel (ej.
  // aceptó una invitación a un segundo hotel), prioriza la membresía más
  // reciente en vez de una arbitraria — así después de aceptar una
  // invitación aterriza en el hotel al que se acaba de unir, no en el viejo.
  const usuario = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId },
    include: { propiedad: true },
    orderBy: { creadoEn: "desc" },
  });

  return usuario;
}

export async function getCurrentPropiedad(propiedadId?: string) {
  const { userId } = await auth();
  if (!userId) return null;

  const where = propiedadId
    ? { clerkUserId: userId, propiedadId }
    : { clerkUserId: userId };

  const usuario = await prisma.usuarioPropiedad.findFirst({
    where,
    include: { propiedad: true },
    orderBy: { creadoEn: "desc" },
  });

  return usuario?.propiedad ?? null;
}

export async function requireRole(roles: RolUsuario[]) {
  const { userId } = await auth();
  if (!userId) throw new Error("No autenticado");

  const usuario = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId },
  });

  if (!usuario || !roles.includes(usuario.rol)) {
    throw new Error("Permisos insuficientes");
  }

  return usuario;
}

export async function isSuperAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  const usuario = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId, rol: RolUsuario.SUPER_ADMIN },
  });

  return !!usuario;
}

export async function getPropiedadBySlug(slug: string) {
  return prisma.propiedad.findUnique({ where: { slug } });
}

// Verifica rol y redirige si no tiene acceso.
// Usar al inicio de pages que requieren permisos específicos.
export async function requireAdmin() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");
  const rolesAdmin: string[] = [RolUsuario.ADMIN, RolUsuario.SUPER_ADMIN];
  if (!rolesAdmin.includes(usuario.rol)) {
    redirect("/panel?acceso=denegado");
  }
  return usuario;
}

export async function requireFinanzas() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");
  const rolesFinanzas: string[] = [RolUsuario.ADMIN, RolUsuario.FINANZAS, RolUsuario.SUPER_ADMIN];
  if (!rolesFinanzas.includes(usuario.rol)) {
    redirect("/panel?acceso=denegado");
  }
  return usuario;
}
