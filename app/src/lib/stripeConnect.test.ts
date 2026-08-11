import { describe, expect, it } from "vitest";
import { calcularApplicationFeeCentavos, crearDirectCharge, datosPagoDestino } from "./stripeConnect";

describe("calcularApplicationFeeCentavos", () => {
  it("calcula la comisión en centavos", () => {
    expect(calcularApplicationFeeCentavos(1_000, 3)).toBe(3_000);
  });

  it.each([-1, 100, Number.NaN])("rechaza porcentajes de comisión peligrosos", (porcentaje) => {
    expect(() => calcularApplicationFeeCentavos(1_000, porcentaje)).toThrow("COMISION_PLATAFORMA_INVALIDA");
  });
});

describe("crearDirectCharge", () => {
  it("prepara un cobro directo con comisión de Roomly y el contexto de la cuenta del hotel", () => {
    const cobro = crearDirectCharge({
      stripeConnectAccountId: "acct_hotel",
      stripeConnectHabilitado: true,
    }, 1_000);

    expect(cobro).toEqual({
      paymentIntentData: { application_fee_amount: calcularApplicationFeeCentavos(1_000) },
      requestOptions: { stripeAccount: "acct_hotel" },
      stripeAccountId: "acct_hotel",
    });
    expect(cobro.paymentIntentData).not.toHaveProperty("transfer_data");
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

describe("datosPagoDestino", () => {
  it("conserva el contrato de destination charges para pagos históricos", () => {
    expect(datosPagoDestino({
      stripeConnectAccountId: "acct_hotel",
      stripeConnectHabilitado: true,
    }, 1_000)).toEqual({
      application_fee_amount: 3_000,
      transfer_data: { destination: "acct_hotel" },
    });
  });
});
