"use server";

import { getCurrentUsuario, COOKIE_HOTEL_ACTIVO } from "@/lib/auth";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { marcarNoShow } from "@/lib/negocio/cicloDeVida";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { EstadoReserva } from "@prisma/client";

// Cambia el hotel activo del selector (Sidebar). Solo permite elegir un
// hotel al que el usuario realmente pertenece — nunca confiar en el
// propiedadId que llega del cliente sin verificar.
export async function cambiarHotelActivoAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const propiedadId = formData.get("propiedadId") as string;

  const pertenece = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId, propiedadId },
  });
  if (!pertenece) {
    redirect("/panel?error=" + encodeURIComponent("No perteneces a ese hotel"));
  }

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_HOTEL_ACTIVO, propiedadId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/panel");
}

export async function marcarLateCheckInDashboardAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
  });
  if (!reserva || reserva.estado !== EstadoReserva.CONFIRMADA) {
    redirect("/panel?error=" + encodeURIComponent("Reserva no encontrada o ya no está pendiente de check-in"));
  }

  const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: usuario.propiedadId } });

  await prisma.reserva.update({
    where: { id: reservaId },
    data: {
      lateCheckInEn: new Date(),
      cargoLateCheckIn: propiedad.costoLateCheckIn,
    },
  });

  redirect("/panel?lateCheckIn=1");
}

export async function marcarNoShowDashboardAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;

  try {
    await marcarNoShow(reservaId, usuario.propiedadId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    redirect("/panel?error=" + encodeURIComponent(msg));
  }

  redirect("/panel?noShow=1");
}
