import { EstadoDePago, TipoEspecialReserva } from "@prisma/client";

const TIPOS_CON_PRECIO_MANUAL = new Set<TipoEspecialReserva>([
  TipoEspecialReserva.PRECIO_ACORDADO,
  TipoEspecialReserva.PROMOCION,
]);

function esImportePositivo(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value > 0;
}

export function resolverTotalReserva(
  totalCalculado: number,
  tipoEspecial?: TipoEspecialReserva | null,
  totalOverride?: number | null
): number {
  if (tipoEspecial === TipoEspecialReserva.CORTESIA) return 0;
  if (tipoEspecial && TIPOS_CON_PRECIO_MANUAL.has(tipoEspecial)) {
    if (!esImportePositivo(totalOverride)) throw new Error("PRECIO_ESPECIAL_INVALIDO");
    return totalOverride;
  }
  return totalCalculado;
}

export function resolverMontoCobro(
  total: number,
  esPagoCompleto: boolean,
  montoSolicitado?: number | null
): number {
  if (!esImportePositivo(total)) throw new Error("CORTESIA_NO_ADMITE_PAGO");
  if (esPagoCompleto) return total;
  if (!esImportePositivo(montoSolicitado) || montoSolicitado >= total) {
    throw new Error("ANTICIPO_INVALIDO");
  }
  return montoSolicitado;
}

export function validarPagoManual(
  total: number,
  estado: EstadoDePago,
  montoAnticipo?: number | null
): void {
  if (total === 0 && estado !== EstadoDePago.PENDIENTE) throw new Error("CORTESIA_NO_ADMITE_PAGO");
  if (estado === EstadoDePago.ANTICIPO_PAGADO &&
      (!esImportePositivo(montoAnticipo) || montoAnticipo >= total)) {
    throw new Error("ANTICIPO_INVALIDO");
  }
}

export function estadoSegunMontoRecibido(total: number, montoRecibido: number): EstadoDePago {
  if (!Number.isFinite(montoRecibido) || montoRecibido <= 0) return EstadoDePago.PENDIENTE;
  return montoRecibido + 0.005 >= total
    ? EstadoDePago.PAGADO_COMPLETO
    : EstadoDePago.ANTICIPO_PAGADO;
}

export function validarDatosReserva(
  fechaIngreso: Date,
  fechaSalida: Date,
  numPersonas: number,
  capacidadMin: number,
  capacidadMax: number
): void {
  if (Number.isNaN(fechaIngreso.getTime()) || Number.isNaN(fechaSalida.getTime()) || fechaSalida <= fechaIngreso) {
    throw new Error("FECHAS_INVALIDAS");
  }
  if (!Number.isInteger(numPersonas) || numPersonas < capacidadMin || numPersonas > capacidadMax) {
    throw new Error("CAPACIDAD_INVALIDA");
  }
}
