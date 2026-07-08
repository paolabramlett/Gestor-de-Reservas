// Cálculo puro de ocupación por noche — sin acceso a base de datos, para
// poder testearlo de forma aislada (igual que tarifas/alertasCheckIn).

export type ReservaOcupacion = {
  fechaIngreso: Date;
  fechaSalida: Date;
  // null = reserva confirmada pero aún sin habitación física asignada.
  // Aunque no tenga cuarto asignado, SÍ consume inventario del tipo.
  habitacionAsignadaId: string | null;
};

export type BloqueoOcupacion = {
  habitacionId: string;
  fechaInicio: Date;
  fechaFin: Date;
};

const DIA_MS = 86_400_000;

/**
 * Pico de unidades ocupadas en cualquier noche del rango [ingreso, salida).
 *
 * Por cada noche cuenta: habitaciones físicas distintas ocupadas (reservas
 * asignadas + bloqueos, sin doble conteo si coinciden en el mismo cuarto)
 * más las reservas sin asignar (cada una consume una unidad del tipo).
 * La disponibilidad del tipo es: totalHabitaciones - este pico.
 */
export function picoOcupacionPorNoche(
  fechaIngreso: Date,
  fechaSalida: Date,
  reservas: ReservaOcupacion[],
  bloqueos: BloqueoOcupacion[]
): number {
  let pico = 0;

  for (let noche = fechaIngreso.getTime(); noche < fechaSalida.getTime(); noche += DIA_MS) {
    const habitacionesOcupadas = new Set<string>();
    let sinAsignar = 0;

    for (const r of reservas) {
      if (r.fechaIngreso.getTime() <= noche && r.fechaSalida.getTime() > noche) {
        if (r.habitacionAsignadaId) habitacionesOcupadas.add(r.habitacionAsignadaId);
        else sinAsignar++;
      }
    }
    for (const b of bloqueos) {
      if (b.fechaInicio.getTime() <= noche && b.fechaFin.getTime() > noche) {
        habitacionesOcupadas.add(b.habitacionId);
      }
    }

    pico = Math.max(pico, habitacionesOcupadas.size + sinAsignar);
  }

  return pico;
}
