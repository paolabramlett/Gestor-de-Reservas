import { aCentavos, aMxn } from "./resumenFinanciero";

export type PagoManualLegacy = {
  estado: string;
  montoAnticipoCentavos: number | null;
  totalCentavos: number;
  stripeNetoCentavos: number;
  nota?: string | null;
};

export type CandidatoPagoExternoLegacy = {
  montoCentavos: number;
  nota: string;
  requiereRevision: boolean;
  motivoRevision: string | null;
};

export function clasificarPagoManualLegacy(input: PagoManualLegacy): CandidatoPagoExternoLegacy | null {
  if (input.stripeNetoCentavos < 0) {
    const montoCentavos = input.montoAnticipoCentavos ?? aCentavos(aMxn(input.totalCentavos - input.stripeNetoCentavos));
    return {
      montoCentavos: aCentavos(aMxn(montoCentavos)),
      nota: input.nota ?? "",
      requiereRevision: true,
      motivoRevision: "STRIPE_NETO_NEGATIVO",
    };
  }

  if (input.estado === "PENDIENTE" && input.montoAnticipoCentavos === null) return null;

  if (input.estado === "PAGADO_COMPLETO" && input.montoAnticipoCentavos === null) {
    const montoCentavos = aCentavos(aMxn(input.totalCentavos - input.stripeNetoCentavos));
    if (montoCentavos === 0) return null;
    const motivoRevision = montoCentavos < 0 ? "SALDO_EXTERNO_NEGATIVO" : null;
    return {
      montoCentavos,
      nota: input.nota ?? "",
      requiereRevision: motivoRevision !== null,
      motivoRevision,
    };
  }

  if (input.estado === "PAGADO_COMPLETO" && input.montoAnticipoCentavos !== null) {
    const montoCentavos = aCentavos(aMxn(input.montoAnticipoCentavos));
    const saldoEsperadoCentavos = aCentavos(aMxn(input.totalCentavos - input.stripeNetoCentavos));
    const motivoRevision = montoCentavos <= 0
      ? "MONTO_NO_POSITIVO"
      : montoCentavos !== saldoEsperadoCentavos
        ? "MONTO_NO_COINCIDE_SALDO"
        : null;
    return {
      montoCentavos,
      nota: input.nota ?? "",
      requiereRevision: motivoRevision !== null,
      motivoRevision,
    };
  }

  if (input.estado === "PENDIENTE" && input.montoAnticipoCentavos !== null) {
    return {
      montoCentavos: aCentavos(aMxn(input.montoAnticipoCentavos)),
      nota: input.nota ?? "",
      requiereRevision: true,
      motivoRevision: "ESTADO_AMBIGUO",
    };
  }

  if (input.estado === "ANTICIPO_PAGADO" && input.montoAnticipoCentavos === null) {
    return {
      montoCentavos: 0,
      nota: input.nota ?? "",
      requiereRevision: true,
      motivoRevision: "ESTADO_AMBIGUO",
    };
  }

  if (input.estado === "ANTICIPO_PAGADO" && input.montoAnticipoCentavos !== null) {
    const montoCentavos = aCentavos(aMxn(input.montoAnticipoCentavos));
    const motivoRevision = montoCentavos <= 0
      ? "MONTO_NO_POSITIVO"
      : montoCentavos > input.totalCentavos
        ? "MONTO_SUPERA_TOTAL"
        : montoCentavos + input.stripeNetoCentavos > input.totalCentavos
          ? "PAGOS_SUPERAN_TOTAL"
        : null;
    return {
      montoCentavos,
      nota: input.nota ?? "",
      requiereRevision: motivoRevision !== null,
      motivoRevision,
    };
  }

  if (input.montoAnticipoCentavos !== null) {
    return {
      montoCentavos: aCentavos(aMxn(input.montoAnticipoCentavos)),
      nota: input.nota ?? "",
      requiereRevision: true,
      motivoRevision: "ESTADO_AMBIGUO",
    };
  }

  return null;
}
