export function cuentaConnectNecesitaReemplazo(error: unknown): boolean {
  const stripeError = error as { code?: string; statusCode?: number };
  return stripeError?.code === "resource_missing" && stripeError?.statusCode === 404;
}

export function esPlataformaConnectNoConfigurada(error: unknown): boolean {
  const stripeError = error as { code?: string; statusCode?: number };
  return stripeError?.code === "platform_account_required" && stripeError?.statusCode === 403;
}
