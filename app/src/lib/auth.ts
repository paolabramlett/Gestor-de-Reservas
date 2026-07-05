import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { RolUsuario } from "@prisma/client";

export type { RolUsuario };

export const COOKIE_HOTEL_ACTIVO = "roomly_propiedad_id";

// Si el usuario pertenece a más de un hotel, respeta cuál eligió con el
// selector (cookie). Si no hay cookie o ya no aplica (ej. lo quitaron de ese
// hotel), cae de vuelta a la membresía más reciente en vez de una arbitraria.
export async function getCurrentUsuario() {
  const { userId } = await auth();
  if (!userId) return null;

  const membresias = await prisma.usuarioPropiedad.findMany({
    where: { clerkUserId: userId },
    include: { propiedad: true },
    orderBy: { creadoEn: "desc" },
  });
  if (membresias.length === 0) return null;

  const cookieStore = await cookies();
  const propiedadElegida = cookieStore.get(COOKIE_HOTEL_ACTIVO)?.value;

  const seleccionada = propiedadElegida
    ? membresias.find((m) => m.propiedadId === propiedadElegida)
    : undefined;

  return seleccionada ?? membresias[0];
}

// Todos los hoteles a los que pertenece el usuario actual — para el
// selector de hotel en el Sidebar. Vacío o [] si solo pertenece a uno.
export async function getMisHoteles() {
  const { userId } = await auth();
  if (!userId) return [];

  return prisma.usuarioPropiedad.findMany({
    where: { clerkUserId: userId },
    include: { propiedad: { select: { id: true, nombre: true } } },
    orderBy: { creadoEn: "desc" },
  });
}

export async function getCurrentPropiedad(propiedadId?: string) {
  // Sin propiedadId explícito: usar la misma resolución que getCurrentUsuario
  // (respeta el selector de hotel) en vez de una consulta separada que
  // ignoraría cuál hotel tiene activo el usuario.
  if (!propiedadId) {
    const usuario = await getCurrentUsuario();
    return usuario?.propiedad ?? null;
  }

  const { userId } = await auth();
  if (!userId) return null;

  const usuario = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId, propiedadId },
    include: { propiedad: true },
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
