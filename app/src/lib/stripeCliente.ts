import { loadStripe } from "@stripe/stripe-js";

export function cargarStripeParaCuenta(
  publishableKey: string,
  stripeAccountId: string
) {
  return loadStripe(publishableKey, { stripeAccount: stripeAccountId });
}
