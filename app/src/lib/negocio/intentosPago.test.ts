import { describe, expect, it } from "vitest";
import { validarAutorizacionIntentoPago } from "./intentosPago";

const persistido = {
  intentoId: "intento_1",
  propiedadId: "prop_1",
  stripeConnectAccountId: "acct_hotel",
  tipo: "RESERVA_INDIVIDUAL" as const,
  montoCentavos: 100_000,
  moneda: "mxn" as const,
  datosReserva: {},
  estado: "PENDIENTE" as const,
  stripePaymentIntentId: "pi_hotel",
};

describe("validarAutorizacionIntentoPago", () => {
  it("acepta el pago exacto autorizado por Roomly", () => {
    expect(() => validarAutorizacionIntentoPago(persistido, {
      intentoId: "intento_1",
      propiedadId: "prop_1",
      stripeConnectAccountId: "acct_hotel",
      montoCentavos: 100_000,
      moneda: "mxn",
      stripePaymentIntentId: "pi_hotel",
    })).not.toThrow();
  });

  it.each([
    { stripeConnectAccountId: "acct_otro" },
    { propiedadId: "prop_otra" },
    { montoCentavos: 99_999 },
    { stripePaymentIntentId: "pi_otro" },
  ])("rechaza cualquier cambio financiero: %o", (cambio) => {
    expect(() => validarAutorizacionIntentoPago(persistido, {
      intentoId: "intento_1",
      propiedadId: "prop_1",
      stripeConnectAccountId: "acct_hotel",
      montoCentavos: 100_000,
      moneda: "mxn",
      stripePaymentIntentId: "pi_hotel",
      ...cambio,
    })).toThrow("INTENTO_PAGO_NO_AUTORIZADO");
  });
});
