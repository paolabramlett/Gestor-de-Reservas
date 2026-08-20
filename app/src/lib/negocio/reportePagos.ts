export type FuenteMovimientoPago =
  | "STRIPE"
  | "EFECTIVO"
  | "TRANSFERENCIA"
  | "TERMINAL_EXTERNA"
  | "OTRO";

export type MovimientoPago = {
  fecha: Date;
  fuente: FuenteMovimientoPago;
  montoCentavos: number;
};

export type PeriodoReportePagos = {
  inicio: Date;
  fin: Date;
};

export type ResumenMovimientos = {
  stripeCentavos: number;
  efectivoCentavos: number;
  transferenciaCentavos: number;
  terminalExternaCentavos: number;
  otrosCentavos: number;
  netoCentavos: number;
};

function sumarCentavos(actual: number, movimiento: number) {
  const total = actual + movimiento;
  if (!Number.isSafeInteger(total)) throw new Error("CENTAVOS_INVALIDOS");
  return total;
}

export function resumirMovimientos(
  periodo: PeriodoReportePagos,
  movimientos: MovimientoPago[]
): ResumenMovimientos {
  const resumen: ResumenMovimientos = {
    stripeCentavos: 0,
    efectivoCentavos: 0,
    transferenciaCentavos: 0,
    terminalExternaCentavos: 0,
    otrosCentavos: 0,
    netoCentavos: 0,
  };

  for (const movimiento of movimientos) {
    if (movimiento.fecha < periodo.inicio || movimiento.fecha > periodo.fin) continue;
    if (!Number.isSafeInteger(movimiento.montoCentavos)) throw new Error("CENTAVOS_INVALIDOS");

    if (movimiento.fuente === "STRIPE") resumen.stripeCentavos = sumarCentavos(resumen.stripeCentavos, movimiento.montoCentavos);
    else if (movimiento.fuente === "EFECTIVO") resumen.efectivoCentavos = sumarCentavos(resumen.efectivoCentavos, movimiento.montoCentavos);
    else if (movimiento.fuente === "TRANSFERENCIA") resumen.transferenciaCentavos = sumarCentavos(resumen.transferenciaCentavos, movimiento.montoCentavos);
    else if (movimiento.fuente === "TERMINAL_EXTERNA") resumen.terminalExternaCentavos = sumarCentavos(resumen.terminalExternaCentavos, movimiento.montoCentavos);
    else resumen.otrosCentavos = sumarCentavos(resumen.otrosCentavos, movimiento.montoCentavos);

    resumen.netoCentavos = sumarCentavos(resumen.netoCentavos, movimiento.montoCentavos);
  }

  return resumen;
}
