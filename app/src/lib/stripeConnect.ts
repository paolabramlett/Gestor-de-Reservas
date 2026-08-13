import Stripe from "stripe";
import { createHash } from "node:crypto";

export type PropiedadConectada = {
  stripeConnectAccountId: string | null;
  stripeConnectHabilitado: boolean;
};

// Cada hotel Pro debe tener su propia cuenta de Stripe conectada y habilitada
// antes de poder cobrar a huéspedes — el dinero va directo a su cuenta,
// nunca pasa por la de Roomly. Lanza un error claro si falta completarlo.
export function requerirCuentaConectada(propiedad: PropiedadConectada): string {
  if (!propiedad.stripeConnectAccountId || !propiedad.stripeConnectHabilitado) {
    throw new Error(
      "CONNECT_PENDIENTE: Este hotel todavía no completa la configuración de pagos con Stripe. Ve a Configuración → Pagos para conectarla."
    );
  }
  return propiedad.stripeConnectAccountId;
}

// Contexto inmutable para un direct charge. El PaymentIntent y todo su saldo
// viven en la cuenta Connect del hotel; Roomly no cobra comisión transaccional.
export function crearDirectCharge(
  propiedad: PropiedadConectada,
  _montoMxn: number
): {
  paymentIntentData: Record<string, never>;
  requestOptions: { stripeAccount: string };
  stripeAccountId: string;
} {
  const stripeAccountId = requerirCuentaConectada(propiedad);
  return {
    // La reservación pertenece íntegramente al hotel. Roomly cobra su plan
    // SaaS por separado y nunca genera saldo con pagos de huéspedes.
    paymentIntentData: {},
    requestOptions: { stripeAccount: stripeAccountId },
    stripeAccountId,
  };
}

export function crearClaveIdempotenciaDirectCharge(
  operacion: string,
  componentes: Array<string | number>
): string {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(componentes))
    .digest("hex");
  return `roomly-direct-${operacion}-${fingerprint}`;
}

// Reembolso correcto para cargos con Connect (destination charges): sin
// reverse_transfer, Stripe devuelve el dinero al huésped desde el saldo de
// LA PLATAFORMA mientras el hotel conserva su transferencia — Roomly
// perdería ese dinero. reverse_transfer recupera la parte del hotel y
// refund_application_fee la comisión de Roomly, proporcionales al monto.
// Para cargos viejos sin transfer_data (previos a Connect), esos flags son
// inválidos — se detecta el tipo de cargo y se reembolsa como corresponde.
export async function reembolsarPagoHuesped(
  paymentIntentId: string,
  montoCentavos?: number,
  idempotencyKey?: string
) {
  const { stripe } = await import("./stripe");
  const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
  const esDestinationCharge = !!intent.transfer_data?.destination;

  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(montoCentavos != null ? { amount: montoCentavos } : {}),
    ...(esDestinationCharge
      ? { reverse_transfer: true, refund_application_fee: true }
      : {}),
  }, idempotencyKey ? { idempotencyKey } : undefined);
}

// Un direct charge pertenece a la cuenta Connect, por lo que el reembolso
// debe crearse en ese mismo contexto. No existe transferencia que revertir.
export async function reembolsarPagoDirectoHuesped(
  paymentIntentId: string,
  stripeConnectAccountId: string,
  montoCentavos?: number,
  idempotencyKey?: string
) {
  const { stripe } = await import("./stripe");
  return stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(montoCentavos != null ? { amount: montoCentavos } : {}),
  }, {
    stripeAccount: stripeConnectAccountId,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  });
}

export function esErrorConnectPendiente(err: unknown): boolean {
  return err instanceof Error && err.message.startsWith("CONNECT_PENDIENTE");
}

export function mensajeErrorConnect(err: unknown): string {
  if (err instanceof Error && err.message.startsWith("CONNECT_PENDIENTE:")) {
    return err.message.replace("CONNECT_PENDIENTE: ", "");
  }
  return err instanceof Error ? err.message : "Error al procesar el pago";
}

export type { Stripe };
