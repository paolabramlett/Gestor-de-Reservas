// Los servidores de Vercel corren en UTC. México (zona Centro, la gran
// mayoría de hoteles pequeños del país) no observa horario de verano desde
// 2022, así que su offset es fijo: UTC-6. Excepción conocida: Quintana Roo
// (UTC-5) y Baja California (UTC-8, con horario de verano) — si el piloto
// crece hacia esas zonas, esto debe volverse configurable por hotel.
const OFFSET_HORAS_MEXICO_CENTRO = 6;

/**
 * Convierte una hora de pared "HH:mm" (pensada en hora de México) más una
 * fecha calendario, al instante UTC real que representa. Se usa para poder
 * comparar contra `new Date()` (que siempre es UTC) sin desalinearse.
 */
export function horaMexicoAUtc(fechaBase: Date, horaHHmm: string): Date {
  const [horas, minutos] = horaHHmm.split(":").map(Number);
  const fecha = new Date(fechaBase);
  fecha.setUTCHours(horas + OFFSET_HORAS_MEXICO_CENTRO, minutos, 0, 0);
  return fecha;
}

/**
 * Medianoche de "hoy" en hora de México, expresada como instante UTC.
 * Reemplaza el patrón `new Date(); .setHours(0,0,0,0)` que en un servidor
 * en UTC calcula medianoche UTC (6pm de México), no medianoche real de México.
 */
export function hoyEnMexico(): Date {
  const ahora = new Date();
  const mexicoMs = ahora.getTime() - OFFSET_HORAS_MEXICO_CENTRO * 60 * 60 * 1000;
  const mexicoDate = new Date(mexicoMs);
  mexicoDate.setUTCHours(0, 0, 0, 0);
  return new Date(mexicoDate.getTime() + OFFSET_HORAS_MEXICO_CENTRO * 60 * 60 * 1000);
}
