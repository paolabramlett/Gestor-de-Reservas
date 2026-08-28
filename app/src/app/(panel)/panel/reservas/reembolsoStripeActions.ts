"use server";

import { revalidatePath } from "next/cache";
import { requireGestionReservas } from "@/lib/auth";
import { reembolsarPagosOnline } from "@/lib/negocio/pagosOnline";

export type ResultadoReembolsoStripe = { ok: boolean; mensaje: string };

export async function reembolsarStripeAction(
  _previo: ResultadoReembolsoStripe,
  formData: FormData,
): Promise<ResultadoReembolsoStripe> {
  try {
    await requireGestionReservas();
    const reservaId = formData.get("reservaId");
    const monto = formData.get("monto");
    const motivo = formData.get("motivo");
    if (typeof reservaId !== "string" || !reservaId || typeof monto !== "string" || !/^\d+(?:[.,]\d{1,2})?$/.test(monto.trim())) {
      return { ok: false, mensaje: "Captura un monto válido." };
    }
    if (typeof motivo !== "string" || motivo.trim().length < 3 || motivo.trim().length > 500) {
      return { ok: false, mensaje: "Indica el motivo del reembolso." };
    }
    const montoMxn = Number(monto.replace(",", "."));
    if (!Number.isFinite(montoMxn) || montoMxn <= 0) return { ok: false, mensaje: "Captura un monto válido." };
    await reembolsarPagosOnline({ reservaId, montoMxn, motivo: motivo.trim() });
    revalidatePath(`/panel/reservas/${reservaId}`);
    return { ok: true, mensaje: "Reembolso enviado a Stripe. El estado se actualizará al confirmar Stripe." };
  } catch (error) {
    const codigo = error instanceof Error ? error.message : "";
    const mensajes: Record<string, string> = {
      SALDO_INSUFICIENTE_PARA_REEMBOLSO: "El monto supera el saldo disponible en Stripe.",
      DESTINO_REEMBOLSO_INVALIDO: "No se pudo identificar la reserva.",
      MONTO_INVALIDO: "Captura un monto válido.",
      CUENTA_ORIGEN_STRIPE_FALTANTE: "La cuenta Stripe de origen no está disponible.",
    };
    return { ok: false, mensaje: mensajes[codigo] ?? "No se pudo iniciar el reembolso." };
  }
}
