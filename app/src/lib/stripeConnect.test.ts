import { describe, expect, it } from "vitest";
import { crearDirectCharge } from "./stripeConnect";

describe("crearDirectCharge", () => {
  it("prepara un cobro íntegramente del hotel sin comisión ni transferencia de Roomly", () => {
    const cobro = crearDirectCharge({
      stripeConnectAccountId: "acct_hotel",
      stripeConnectHabilitado: true,
    }, 1_000);

    expect(cobro).toEqual({
      paymentIntentData: {},
      requestOptions: { stripeAccount: "acct_hotel" },
      stripeAccountId: "acct_hotel",
    });
    expect(cobro.paymentIntentData).not.toHaveProperty("transfer_data");
    expect(cobro.paymentIntentData).not.toHaveProperty("application_fee_amount");
  });

  it("rechaza crear el cobro si falta la cuenta aunque el estado figure habilitado", () => {
    expect(() => crearDirectCharge({
      stripeConnectAccountId: null,
      stripeConnectHabilitado: true,
    }, 1_000)).toThrow("CONNECT_PENDIENTE");
  });

  it("rechaza crear el cobro si la cuenta existe pero los pagos no están habilitados", () => {
    expect(() => crearDirectCharge({
      stripeConnectAccountId: "acct_hotel",
      stripeConnectHabilitado: false,
    }, 1_000)).toThrow("CONNECT_PENDIENTE");
  });
});
