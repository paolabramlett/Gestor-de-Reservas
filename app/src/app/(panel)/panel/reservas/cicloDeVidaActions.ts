"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { checkIn, checkOut, marcarNoShow, cancelarReserva, eliminarReserva } from "@/lib/negocio/cicloDeVida";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

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

// Cancelación masiva desde la lista de reservas. Solo admite SIN_REEMBOLSO o
// TOTAL porque un reembolso PARCIAL requiere un monto específico por reserva —
// eso se sigue haciendo una por una desde el detalle.
export async function cancelarReservasEnLoteAction(formData: FormData): Promise<{ ok: number; error: string[] }> {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const ids = formData.getAll("reservaIds") as string[];
  const politicaReembolso = formData.get("politicaReembolso") as "TOTAL" | "SIN_REEMBOLSO";

  let ok = 0;
  const errores: string[] = [];

  for (const reservaId of ids) {
    try {
      await cancelarReserva({
        reservaId,
        propiedadId: usuario.propiedadId,
        politicaReembolso,
      });
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      errores.push(`${reservaId}: ${msg}`);
    }
  }

  revalidatePath("/panel/reservas");
  return { ok, error: errores };
}

// Eliminación permanente en lote. Solo procede para reservas sin ningún pago
// confirmado (ver tieneEliminacionSegura) — cualquier otra cosa se rechaza
// individualmente para no perder historial de dinero real.
export async function eliminarReservasEnLoteAction(formData: FormData): Promise<{ ok: number; error: string[] }> {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const ids = formData.getAll("reservaIds") as string[];

  let ok = 0;
  const errores: string[] = [];

  for (const reservaId of ids) {
    try {
      await eliminarReserva(reservaId, usuario.propiedadId);
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      errores.push(`${reservaId}: ${msg}`);
    }
  }

  revalidatePath("/panel/reservas");
  return { ok, error: errores };
}
