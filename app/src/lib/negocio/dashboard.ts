type ReservaEstancia = {
  estado: string;
  fechaIngreso: Date;
  fechaSalida: Date;
};

export function esHuespedEnCasa(reserva: ReservaEstancia, hoy: Date): boolean {
  return reserva.estado === "EN_CURSO" &&
    reserva.fechaIngreso <= hoy &&
    reserva.fechaSalida > hoy;
}
