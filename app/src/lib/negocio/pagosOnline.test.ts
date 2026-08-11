import { describe, expect, it } from "vitest";
import { distribuirReembolso, validarCuentaEvento, validarDestinoPago, validarPagoRecibido } from "./pagosOnline";

describe("validarPagoRecibido", () => {
  it("acepta únicamente un pago liquidado por el monto y moneda esperados", () => {
    expect(() => validarPagoRecibido({
      paymentStatus: "paid",
      moneda: "mxn",
      montoRecibidoCentavos: 250_000,
      montoEsperadoCentavos: 250_000,
    })).not.toThrow();
  });

  it.each([
    ["unpaid", "mxn", 250_000, 250_000],
    ["paid", "usd", 250_000, 250_000],
    ["paid", "mxn", 249_999, 250_000],
  ])("rechaza estado, moneda o monto inconsistentes", (paymentStatus, moneda, recibido, esperado) => {
    expect(() => validarPagoRecibido({
      paymentStatus,
      moneda,
      montoRecibidoCentavos: recibido,
      montoEsperadoCentavos: esperado,
    })).toThrow("PAGO_STRIPE_INCONSISTENTE");
  });
});

describe("distribuirReembolso", () => {
  it("reparte el monto entre varios pagos sin superar el saldo de cada uno", () => {
    expect(distribuirReembolso(2_500, [
      { id: "p1", disponibleCentavos: 1_000 },
      { id: "p2", disponibleCentavos: 2_000 },
    ])).toEqual([
      { id: "p1", montoCentavos: 1_000 },
      { id: "p2", montoCentavos: 1_500 },
    ]);
  });

  it("rechaza un reembolso superior al total conciliado", () => {
    expect(() => distribuirReembolso(3_001, [{ id: "p1", disponibleCentavos: 3_000 }]))
      .toThrow("SALDO_INSUFICIENTE_PARA_REEMBOLSO");
  });
});

describe("validarDestinoPago", () => {
  it("rechaza un cargo enviado a otra cuenta conectada", () => {
    expect(() => validarDestinoPago("acct_hotel_b", "acct_hotel_a")).toThrow("DESTINO_STRIPE_INCONSISTENTE");
  });
});

describe("validarCuentaEvento", () => {
  it.each([null, "acct_otro_hotel"])("rechaza eventos que no pertenecen a la cuenta del hotel", (cuentaRecibida) => {
    expect(() => validarCuentaEvento(cuentaRecibida, "acct_hotel")).toThrow("CUENTA_EVENTO_STRIPE_INCONSISTENTE");
  });

  it("acepta un evento de la cuenta Connect esperada", () => {
    expect(() => validarCuentaEvento("acct_hotel", "acct_hotel")).not.toThrow();
  });
});
