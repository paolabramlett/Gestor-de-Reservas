import { horaMexicoAUtc } from "./horaMexico";

export type EtapaAlertaCheckIn = "SIN_LLEGAR" | "SUGERIR_LATE_CHECKIN" | "SUGERIR_NO_SHOW";

/**
 * Combina la fecha de una reserva con la hora de check-in del hotel ("HH:mm",
 * en hora de México) para obtener el instante UTC exacto en el que se
 * esperaba al huésped.
 */
export function horaCheckInEsperada(fechaIngreso: Date, horaCheckIn: string): Date {
  return horaMexicoAUtc(fechaIngreso, horaCheckIn);
}

/**
 * Determina en qué etapa de alerta está una reserva confirmada que aún no
 * ha hecho check-in, según cuántas horas han pasado desde la hora esperada:
 *  - SIN_LLEGAR: ya pasó la hora, pero dentro de la tolerancia normal.
 *  - SUGERIR_LATE_CHECKIN: pasó el umbral de late check-in.
 *  - SUGERIR_NO_SHOW: pasó el umbral de no-show.
 * Devuelve null si aún no ha llegado la hora de check-in.
 */
export function calcularEtapaAlerta(params: {
  fechaIngreso: Date;
  horaCheckIn: string;
  horasParaLateCheckIn: number;
  horasParaNoShow: number;
  ahora: Date;
}): EtapaAlertaCheckIn | null {
  const esperada = horaCheckInEsperada(params.fechaIngreso, params.horaCheckIn);
  const horasTranscurridas = (params.ahora.getTime() - esperada.getTime()) / (60 * 60 * 1000);

  if (horasTranscurridas < 0) return null;
  if (horasTranscurridas >= params.horasParaNoShow) return "SUGERIR_NO_SHOW";
  if (horasTranscurridas >= params.horasParaLateCheckIn) return "SUGERIR_LATE_CHECKIN";
  return "SIN_LLEGAR";
}
