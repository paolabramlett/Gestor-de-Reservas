import Stripe from "stripe";

// Comisión de Roomly sobre cada cobro a huéspedes, además de lo que Stripe
// ya cobra por procesamiento. Configurable por si se ajusta el modelo de
// negocio sin tocar código.
const APPLICATION_FEE_PERCENT = Number(process.env.ROOMLY_APPLICATION_FEE_PERCENT ?? "3");

export function calcularApplicationFeeCentavos(montoMxn: number): number {
  return Math.round(montoMxn * (APPLICATION_FEE_PERCENT / 100) * 100);
}

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

// Datos para agregar a un Stripe Checkout Session (mode: "payment") o
// PaymentIntent, para que el cobro llegue directo a la cuenta del hotel
// (destination charge) con la comisión de Roomly separada automáticamente.
export function datosPagoDestino(
  propiedad: PropiedadConectada,
  montoMxn: number
): { application_fee_amount: number; transfer_data: { destination: string } } {
  const destination = requerirCuentaConectada(propiedad);
  return {
    application_fee_amount: calcularApplicationFeeCentavos(montoMxn),
    transfer_data: { destination },
  };
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
