import { describe, expect, it } from "vitest";
import {
  calcularResumenPagoReserva,
  distribuirReembolso,
  validarCuentaEvento,
  validarDestinoPago,
  validarPagoRecibido,
} from "./pagosOnline";

describe("calcularResumenPagoReserva", () => {
  it("considera liquidada una reserva pagada por Stripe aunque el registro manual siga pendiente", () => {
    expect(calcularResumenPagoReserva({
      totalMxn: 4_000,
      pagoManual: { estadoDePago: "PENDIENTE", montoAnticipo: null },
      pagosOnline: [{
        estado: "PAGADO",
        montoMxn: 4_000,
        montoReembolsadoMxn: 0,
        reembolsoPendienteMxn: 0,
      }],
    })).toEqual({
      montoPagadoMxn: 4_000,
      montoStripeMxn: 4_000,
      montoExternoMxn: 0,
      saldoPendienteMxn: 0,
      pagoCompleto: true,
      metodo: "Stripe",
    });
  });

  it("descuenta reembolsos y conserva disponible únicamente el saldo real", () => {
    expect(calcularResumenPagoReserva({
      totalMxn: 4_000,
      pagoManual: { estadoDePago: "ANTICIPO_PAGADO", montoAnticipo: 500 },
      pagosOnline: [{
        estado: "REEMBOLSADO_PARCIAL",
        montoMxn: 2_000,
        montoReembolsadoMxn: 250,
        reembolsoPendienteMxn: 250,
      }],
    })).toMatchObject({
      montoPagadoMxn: 2_000,
      montoStripeMxn: 1_500,
      montoExternoMxn: 500,
      saldoPendienteMxn: 2_000,
      pagoCompleto: false,
      metodo: "Stripe + pago externo",
    });
  });

  it("conserva el importe externo real si Stripe se reembolsa después de completar un pago mixto", () => {
    expect(calcularResumenPagoReserva({
      totalMxn: 4_000,
      pagoManual: { estadoDePago: "PAGADO_COMPLETO", montoAnticipo: 2_000 },
      pagosOnline: [{
        estado: "REEMBOLSADO",
        montoMxn: 2_000,
        montoReembolsadoMxn: 2_000,
        reembolsoPendienteMxn: 0,
      }],
    })).toMatchObject({
      montoPagadoMxn: 2_000,
      montoExternoMxn: 2_000,
      saldoPendienteMxn: 2_000,
      pagoCompleto: false,
      metodo: "Pago externo",
    });
  });

  it("mantiene la compatibilidad de un pago externo completo sin anticipo registrado", () => {
    expect(calcularResumenPagoReserva({
      totalMxn: 1_250,
      pagoManual: { estadoDePago: "PAGADO_COMPLETO", montoAnticipo: 0 },
      pagosOnline: [],
    })).toEqual({
      montoPagadoMxn: 1_250,
      montoStripeMxn: 0,
      montoExternoMxn: 1_250,
      saldoPendienteMxn: 0,
      pagoCompleto: true,
      metodo: "Pago externo",
    });
  });
});

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
