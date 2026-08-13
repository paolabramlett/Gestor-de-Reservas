type CuentaConnectRecuperada = {
  charges_enabled?: boolean;
  capabilities?: { card_payments?: string | null };
  controller?: {
    fees?: { payer?: string };
    losses?: { payments?: string };
    requirement_collection?: string;
    stripe_dashboard?: { type?: string };
  };
};

export function cuentaConnectPuedeCobrarSinRiesgoPlataforma(
  cuenta: CuentaConnectRecuperada
): boolean {
  return (
    cuentaConnectEsCompatible(cuenta) &&
    cuenta.charges_enabled === true &&
    cuenta.capabilities?.card_payments === "active"
  );
}

export function cuentaConnectEsCompatible(cuenta: CuentaConnectRecuperada): boolean {
  const controller = cuenta.controller;
  return (
    controller?.fees?.payer === "account" &&
    controller.losses?.payments === "stripe" &&
    controller.requirement_collection === "stripe" &&
    controller.stripe_dashboard?.type === "full"
  );
}

export function cuentaConnectUsaDashboardCompleto(cuenta: CuentaConnectRecuperada): boolean {
  return cuenta.controller?.stripe_dashboard?.type === "full";
}

export function cuentaConnectNecesitaReemplazo(error: unknown): boolean {
  const stripeError = error as { code?: string; statusCode?: number };
  return stripeError?.code === "resource_missing" && stripeError?.statusCode === 404;
}

export function esPlataformaConnectNoConfigurada(error: unknown): boolean {
  const stripeError = error as { code?: string; statusCode?: number };
  return stripeError?.code === "platform_account_required" && stripeError?.statusCode === 403;
}
