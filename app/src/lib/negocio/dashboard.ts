type ReservaEstancia = {
  estado: string;
  fechaIngreso: Date;
  fechaSalida: Date;
};

export function inicioDiaCalendarioUtc(fecha: Date): Date {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

export function esHuespedEnCasa(reserva: ReservaEstancia, hoy: Date): boolean {
  return reserva.estado === "EN_CURSO" &&
    reserva.fechaIngreso <= hoy &&
    reserva.fechaSalida > hoy;
}
