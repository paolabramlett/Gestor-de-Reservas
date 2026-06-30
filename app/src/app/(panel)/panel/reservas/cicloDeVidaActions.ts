"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { checkIn, checkOut, marcarNoShow, cancelarReserva } from "@/lib/negocio/cicloDeVida";
import { redirect } from "next/navigation";

export async function checkInAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  try {
    await checkIn(reservaId, usuario.propiedadId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error";
    redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent(msg)}`);
  }
  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Check-in registrado")}`);
}

export async function checkOutAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  await checkOut(reservaId, usuario.propiedadId);
  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Check-out registrado")}`);
}

export async function noShowAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  await marcarNoShow(reservaId, usuario.propiedadId);
  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Marcado como No-Show")}`);
}

export async function cancelarReservaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const politicaReembolso = formData.get("politicaReembolso") as "TOTAL" | "PARCIAL" | "SIN_REEMBOLSO";
  const montoParcialMxn = formData.get("montoParcialMxn")
    ? Number(formData.get("montoParcialMxn"))
    : undefined;

  await cancelarReserva({
    reservaId,
    propiedadId: usuario.propiedadId,
    politicaReembolso,
    montoParcialMxn,
  });
  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Reserva cancelada")}`);
}
