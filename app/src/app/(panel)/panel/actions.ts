"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marcarNoShow } from "@/lib/negocio/cicloDeVida";
import { redirect } from "next/navigation";
import { EstadoReserva } from "@prisma/client";

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
