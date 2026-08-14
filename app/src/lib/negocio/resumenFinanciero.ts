export type EstadoFinanciero = "SIN_PAGOS" | "PAGO_PARCIAL" | "PAGO_COMPLETO";

export type ResumenFinancieroInput = {
  totalReservaCentavos: number;
  pagosStripe: Array<{
    cobradoCentavos: number;
    reembolsadoCentavos: number;
    reembolsoPendienteCentavos: number;
  }>;
  pagosExternos: Array<{ cobradoCentavos: number; ajustesCentavos: number }>;
};

export type ResumenFinanciero = {
  totalReservaCentavos: number;
  stripeNetoCentavos: number;
  externoNetoCentavos: number;
  pagadoNetoCentavos: number;
  saldoPendienteCentavos: number;
  estado: EstadoFinanciero;
};

function validarCentavos(centavos: number): number {
  if (!Number.isSafeInteger(centavos)) throw new Error("CENTAVOS_INVALIDOS");
  return centavos;
}

export function aCentavos(montoMxn: number): number {
  return validarCentavos(Math.round(montoMxn * 100));
}

export function aMxn(centavos: number): number {
  return validarCentavos(centavos) / 100;
}

export function netoPagoStripeCentavos(pago: ResumenFinancieroInput["pagosStripe"][number]): number {
  return validarCentavos(Math.max(
    0,
    validarCentavos(pago.cobradoCentavos)
      - validarCentavos(pago.reembolsadoCentavos)
      - validarCentavos(pago.reembolsoPendienteCentavos)
  ));
}

export function calcularResumenFinanciero(input: ResumenFinancieroInput): ResumenFinanciero {
  if (!Number.isSafeInteger(input.totalReservaCentavos) || input.totalReservaCentavos < 0) {
    throw new Error("TOTAL_RESERVA_INVALIDO");
  }
  const stripeNetoCentavos = input.pagosStripe.reduce(
    (s, p) => validarCentavos(s + netoPagoStripeCentavos(p)),
    0
  );
  const externoNetoCentavos = input.pagosExternos.reduce(
    (s, p) => validarCentavos(s + Math.max(
      0,
      validarCentavos(p.cobradoCentavos) - validarCentavos(p.ajustesCentavos)
    )),
    0
  );
  const pagadoNetoCentavos = Math.min(input.totalReservaCentavos, Math.max(0, stripeNetoCentavos + externoNetoCentavos));
  const saldoPendienteCentavos = Math.max(0, input.totalReservaCentavos - pagadoNetoCentavos);
  const estado = pagadoNetoCentavos === 0 ? "SIN_PAGOS" : saldoPendienteCentavos === 0 ? "PAGO_COMPLETO" : "PAGO_PARCIAL";

  return {
    totalReservaCentavos: input.totalReservaCentavos,
    stripeNetoCentavos,
    externoNetoCentavos,
    pagadoNetoCentavos,
    saldoPendienteCentavos,
    estado,
  };
}
