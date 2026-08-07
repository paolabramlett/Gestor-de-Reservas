export type IntentStripeNormalizado = {
  status: string;
  moneda: string;
  montoRecibidoCentavos: number;
  montoReembolsadoCentavos: number;
  propiedadIdMetadata: string | null;
  cuentaConnectDestino: string | null;
};

export type ResultadoConciliacion =
  | { estado: "CONCILIABLE"; montoCentavos: number; montoReembolsadoCentavos: number }
  | { estado: "YA_CONCILIADO" }
  | { estado: "REVISION_MANUAL"; motivo: string };

export function clasificarPagoLegacy(input: {
  yaConciliado: boolean;
  propiedadIdEsperada: string;
  cuentaConnectEsperada: string | null;
  intent: IntentStripeNormalizado | null;
}): ResultadoConciliacion {
  if (input.yaConciliado) return { estado: "YA_CONCILIADO" };
  if (!input.intent) return { estado: "REVISION_MANUAL", motivo: "PAYMENT_INTENT_NO_ENCONTRADO" };
  if (input.intent.status !== "succeeded") return { estado: "REVISION_MANUAL", motivo: "PAGO_NO_EXITOSO" };
  if (input.intent.moneda.toLowerCase() !== "mxn") return { estado: "REVISION_MANUAL", motivo: "MONEDA_NO_MXN" };
  if (!Number.isInteger(input.intent.montoRecibidoCentavos) || input.intent.montoRecibidoCentavos <= 0) {
    return { estado: "REVISION_MANUAL", motivo: "MONTO_RECIBIDO_INVALIDO" };
  }
  if (
    !Number.isInteger(input.intent.montoReembolsadoCentavos) ||
    input.intent.montoReembolsadoCentavos < 0 ||
    input.intent.montoReembolsadoCentavos > input.intent.montoRecibidoCentavos
  ) return { estado: "REVISION_MANUAL", motivo: "MONTO_REEMBOLSADO_INVALIDO" };
  if (input.intent.propiedadIdMetadata !== input.propiedadIdEsperada) {
    return { estado: "REVISION_MANUAL", motivo: "PROPIEDAD_METADATA_INCONSISTENTE" };
  }
  if (!input.cuentaConnectEsperada) return { estado: "REVISION_MANUAL", motivo: "CUENTA_CONNECT_NO_CONFIGURADA" };
  if (input.intent.cuentaConnectDestino !== input.cuentaConnectEsperada) {
    return { estado: "REVISION_MANUAL", motivo: "DESTINO_CONNECT_INCONSISTENTE" };
  }
  return {
    estado: "CONCILIABLE",
    montoCentavos: input.intent.montoRecibidoCentavos,
    montoReembolsadoCentavos: input.intent.montoReembolsadoCentavos,
  };
}
