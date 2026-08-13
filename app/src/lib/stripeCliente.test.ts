import { describe, expect, it, vi } from "vitest";

const { loadStripe } = vi.hoisted(() => ({
  loadStripe: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@stripe/stripe-js", () => ({ loadStripe }));

import { cargarStripeParaCuenta } from "./stripeCliente";

describe("cargarStripeParaCuenta", () => {
  it("crea Stripe.js dentro de la cuenta que originó el client secret", () => {
    cargarStripeParaCuenta("pk_test_roomly", "acct_hotel");

    expect(loadStripe).toHaveBeenCalledWith("pk_test_roomly", {
      stripeAccount: "acct_hotel",
    });
  });
});
