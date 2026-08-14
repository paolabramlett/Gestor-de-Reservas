import { describe, expect, it } from "vitest";
import { aCentavos, aMxn, calcularResumenFinanciero, netoPagoStripeCentavos } from "./resumenFinanciero";

describe("calcularResumenFinanciero", () => {
  it("separa un anticipo Stripe del saldo pendiente", () => {
    expect(calcularResumenFinanciero({
      totalReservaCentavos: 600_000,
      pagosStripe: [{ cobradoCentavos: 300_000, reembolsadoCentavos: 0, reembolsoPendienteCentavos: 0 }],
      pagosExternos: [],
    })).toMatchObject({
      stripeNetoCentavos: 300_000,
      externoNetoCentavos: 0,
      pagadoNetoCentavos: 300_000,
      saldoPendienteCentavos: 300_000,
      estado: "PAGO_PARCIAL",
    });
  });

  it("reabre únicamente el saldo reembolsado", () => {
    expect(calcularResumenFinanciero({
      totalReservaCentavos: 600_000,
      pagosStripe: [{ cobradoCentavos: 300_000, reembolsadoCentavos: 100_000, reembolsoPendienteCentavos: 0 }],
      pagosExternos: [{ cobradoCentavos: 300_000, ajustesCentavos: 0 }],
    }).saldoPendienteCentavos).toBe(100_000);
  });

  it("rechaza totales de reserva negativos", () => {
    expect(() => calcularResumenFinanciero({
      totalReservaCentavos: -1,
      pagosStripe: [],
      pagosExternos: [],
    })).toThrow("TOTAL_RESERVA_INVALIDO");
  });

  it("rechaza pagos con centavos no enteros", () => {
    expect(() => calcularResumenFinanciero({
      totalReservaCentavos: 600_000,
      pagosStripe: [{ cobradoCentavos: 300_000.5, reembolsadoCentavos: 0, reembolsoPendienteCentavos: 0 }],
      pagosExternos: [],
    })).toThrow("CENTAVOS_INVALIDOS");
  });
});

describe("aCentavos", () => {
  it("convierte importes MXN a centavos", () => {
    expect(aCentavos(1_234.56)).toBe(123_456);
  });

  it("rechaza importes que no caben en centavos seguros", () => {
    expect(() => aCentavos(Number.MAX_VALUE)).toThrow("CENTAVOS_INVALIDOS");
  });
});

describe("aMxn", () => {
  it("convierte centavos seguros a importes MXN", () => {
    expect(aMxn(123_456)).toBe(1_234.56);
  });

  it("rechaza centavos no enteros", () => {
    expect(() => aMxn(123_456.5)).toThrow("CENTAVOS_INVALIDOS");
  });
});

describe("netoPagoStripeCentavos", () => {
  it("descuenta reembolsos confirmados y pendientes", () => {
    expect(netoPagoStripeCentavos({
      cobradoCentavos: 300_000,
      reembolsadoCentavos: 100_000,
      reembolsoPendienteCentavos: 50_000,
    })).toBe(150_000);
  });
});
