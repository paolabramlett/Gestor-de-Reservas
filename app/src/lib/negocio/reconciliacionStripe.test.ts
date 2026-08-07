import { describe, expect, it } from "vitest";
import { clasificarPagoLegacy } from "./reconciliacionStripe";

describe("clasificarPagoLegacy", () => {
  const base = {
    status: "succeeded",
    moneda: "mxn",
    montoRecibidoCentavos: 12345,
    montoReembolsadoCentavos: 0,
    propiedadIdMetadata: "prop_1",
    cuentaConnectDestino: "acct_1",
  };

  it("acepta un PaymentIntent exitoso que coincide con propiedad y destino", () => {
    expect(clasificarPagoLegacy({
      yaConciliado: false,
      propiedadIdEsperada: "prop_1",
      cuentaConnectEsperada: "acct_1",
      intent: {
        status: "succeeded",
        moneda: "mxn",
        montoRecibidoCentavos: 12345,
        montoReembolsadoCentavos: 0,
        propiedadIdMetadata: "prop_1",
        cuentaConnectDestino: "acct_1",
      },
    })).toEqual({ estado: "CONCILIABLE", montoCentavos: 12345, montoReembolsadoCentavos: 0 });
  });

  it("no vuelve a conciliar un PaymentIntent que ya existe en el ledger", () => {
    expect(clasificarPagoLegacy({
      yaConciliado: true,
      propiedadIdEsperada: "prop_1",
      cuentaConnectEsperada: "acct_1",
      intent: base,
    })).toEqual({ estado: "YA_CONCILIADO" });
  });

  it("envía a revisión un PaymentIntent inexistente", () => {
    expect(clasificarPagoLegacy({
      yaConciliado: false,
      propiedadIdEsperada: "prop_1",
      cuentaConnectEsperada: "acct_1",
      intent: null,
    })).toEqual({ estado: "REVISION_MANUAL", motivo: "PAYMENT_INTENT_NO_ENCONTRADO" });
  });

  it.each([
    ["estado", { status: "processing" }, "PAGO_NO_EXITOSO"],
    ["moneda", { moneda: "usd" }, "MONEDA_NO_MXN"],
    ["monto", { montoRecibidoCentavos: 0 }, "MONTO_RECIBIDO_INVALIDO"],
    ["metadata", { propiedadIdMetadata: "prop_2" }, "PROPIEDAD_METADATA_INCONSISTENTE"],
    ["destino", { cuentaConnectDestino: "acct_2" }, "DESTINO_CONNECT_INCONSISTENTE"],
    ["reembolso", { montoReembolsadoCentavos: 20000 }, "MONTO_REEMBOLSADO_INVALIDO"],
  ])("envía a revisión cuando no coincide %s", (_caso, cambio, motivo) => {
    expect(clasificarPagoLegacy({
      yaConciliado: false,
      propiedadIdEsperada: "prop_1",
      cuentaConnectEsperada: "acct_1",
      intent: { ...base, ...cambio },
    })).toEqual({ estado: "REVISION_MANUAL", motivo });
  });

  it("conserva los centavos exactos y el reembolso confirmado", () => {
    expect(clasificarPagoLegacy({
      yaConciliado: false,
      propiedadIdEsperada: "prop_1",
      cuentaConnectEsperada: "acct_1",
      intent: { ...base, montoRecibidoCentavos: 10001, montoReembolsadoCentavos: 2501 },
    })).toEqual({ estado: "CONCILIABLE", montoCentavos: 10001, montoReembolsadoCentavos: 2501 });
  });
});
