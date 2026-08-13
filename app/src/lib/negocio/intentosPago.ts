import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AutorizacionIntentoPago = {
  intentoId: string;
  propiedadId: string;
  stripeConnectAccountId: string;
  tipo: "RESERVA_INDIVIDUAL" | "RESERVA_GRUPO" | "MANUAL_PAGO" | "GRUPO_PAGO";
  montoCentavos: number;
  moneda: "mxn";
  datosReserva: Prisma.InputJsonValue;
};

type IntentoPersistido = AutorizacionIntentoPago & {
  estado: "PENDIENTE" | "PAGADO" | "CANCELADO";
  stripePaymentIntentId: string | null;
  stripeCheckoutSessionId?: string | null;
};

export function validarAutorizacionIntentoPago(
  persistido: IntentoPersistido,
  recibido: Omit<AutorizacionIntentoPago, "datosReserva" | "tipo"> & { stripePaymentIntentId: string }
): void {
  if (
    persistido.estado === "CANCELADO" ||
    persistido.intentoId !== recibido.intentoId ||
    persistido.propiedadId !== recibido.propiedadId ||
    persistido.stripeConnectAccountId !== recibido.stripeConnectAccountId ||
    persistido.montoCentavos !== recibido.montoCentavos ||
    persistido.moneda !== recibido.moneda ||
    (persistido.stripePaymentIntentId && persistido.stripePaymentIntentId !== recibido.stripePaymentIntentId)
  ) {
    throw new Error("INTENTO_PAGO_NO_AUTORIZADO");
  }
}

export async function registrarIntentoPago(input: AutorizacionIntentoPago): Promise<void> {
  try {
    await prisma.intentoDePagoStripe.create({ data: input });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const existente = await prisma.intentoDePagoStripe.findUnique({ where: { intentoId: input.intentoId } });
    if (
      !existente ||
      existente.propiedadId !== input.propiedadId ||
      existente.stripeConnectAccountId !== input.stripeConnectAccountId ||
      existente.tipo !== input.tipo ||
      existente.montoCentavos !== input.montoCentavos ||
      existente.moneda !== input.moneda ||
      JSON.stringify(existente.datosReserva) !== JSON.stringify(input.datosReserva)
    ) {
      throw new Error("INTENTO_PAGO_REUTILIZADO");
    }
  }
}

export async function asociarIntentoPagoStripe(
  intentoId: string,
  ids: { stripePaymentIntentId?: string; stripeCheckoutSessionId?: string }
): Promise<void> {
  const actualizado = await prisma.intentoDePagoStripe.updateMany({
    where: {
      intentoId,
      ...(ids.stripePaymentIntentId ? { stripePaymentIntentId: null } : {}),
      ...(ids.stripeCheckoutSessionId ? { stripeCheckoutSessionId: null } : {}),
    },
    data: ids,
  });
  if (actualizado.count === 1) return;
  const existente = await prisma.intentoDePagoStripe.findUnique({ where: { intentoId } });
  if (
    !existente ||
    (ids.stripePaymentIntentId && existente.stripePaymentIntentId !== ids.stripePaymentIntentId) ||
    (ids.stripeCheckoutSessionId && existente.stripeCheckoutSessionId !== ids.stripeCheckoutSessionId)
  ) {
    throw new Error("ASOCIACION_STRIPE_INMUTABLE");
  }
}

export async function exigirIntentoPagoAutorizado(input: {
  intentoId: string;
  propiedadId: string;
  stripeConnectAccountId: string;
  montoCentavos: number;
  moneda: "mxn";
  stripePaymentIntentId: string;
  stripeCheckoutSessionId?: string;
}): Promise<IntentoPersistido> {
  const persistido = await prisma.intentoDePagoStripe.findUnique({ where: { intentoId: input.intentoId } });
  if (!persistido) throw new Error("INTENTO_PAGO_NO_AUTORIZADO");
  validarAutorizacionIntentoPago(persistido as IntentoPersistido, input);
  if (
    input.stripeCheckoutSessionId &&
    persistido.stripeCheckoutSessionId !== input.stripeCheckoutSessionId
  ) {
    throw new Error("INTENTO_PAGO_NO_AUTORIZADO");
  }
  if (!persistido.stripePaymentIntentId) {
    await prisma.intentoDePagoStripe.updateMany({
      where: { intentoId: input.intentoId, stripePaymentIntentId: null },
      data: { stripePaymentIntentId: input.stripePaymentIntentId },
    });
  }
  return persistido as IntentoPersistido;
}

export async function obtenerIntentoPago(intentoId: string): Promise<IntentoPersistido> {
  const intento = await prisma.intentoDePagoStripe.findUnique({ where: { intentoId } });
  if (!intento) throw new Error("INTENTO_PAGO_NO_AUTORIZADO");
  return intento as IntentoPersistido;
}

export async function marcarIntentoPagoPagado(intentoId: string): Promise<void> {
  await prisma.intentoDePagoStripe.updateMany({
    where: { intentoId, estado: "PENDIENTE" },
    data: { estado: "PAGADO" },
  });
}
