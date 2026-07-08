import { describe, it, expect } from "vitest";
import { picoOcupacionPorNoche, type ReservaOcupacion, type BloqueoOcupacion } from "./ocupacion";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const reserva = (ingreso: string, salida: string, habitacion: string | null = null): ReservaOcupacion => ({
  fechaIngreso: d(ingreso),
  fechaSalida: d(salida),
  habitacionAsignadaId: habitacion,
});

const bloqueo = (habitacionId: string, inicio: string, fin: string): BloqueoOcupacion => ({
  habitacionId,
  fechaInicio: d(inicio),
  fechaFin: d(fin),
});

describe("picoOcupacionPorNoche", () => {
  it("sin reservas ni bloqueos, el pico es 0", () => {
    expect(picoOcupacionPorNoche(d("2026-08-01"), d("2026-08-05"), [], [])).toBe(0);
  });

  it("cuenta reservas SIN habitación asignada (el bug de sobreventa)", () => {
    const reservas = [reserva("2026-08-01", "2026-08-03"), reserva("2026-08-02", "2026-08-04")];
    expect(picoOcupacionPorNoche(d("2026-08-01"), d("2026-08-04"), reservas, [])).toBe(2);
  });

  it("dos reservas asignadas a la MISMA habitación cuentan como una unidad", () => {
    // No debería pasar (ya lo previene verificarHabitacionLibre), pero si
    // pasara, la ocupación física real es 1 cuarto.
    const reservas = [reserva("2026-08-01", "2026-08-03", "h1"), reserva("2026-08-01", "2026-08-03", "h1")];
    expect(picoOcupacionPorNoche(d("2026-08-01"), d("2026-08-03"), reservas, [])).toBe(1);
  });

  it("mezcla asignadas + sin asignar + bloqueos en la misma noche", () => {
    const reservas = [
      reserva("2026-08-01", "2026-08-05", "h1"),
      reserva("2026-08-02", "2026-08-04"), // sin asignar
    ];
    const bloqueos = [bloqueo("h2", "2026-08-03", "2026-08-06")];
    // Noche del 3: h1 (asignada) + 1 sin asignar + h2 (bloqueo) = 3
    expect(picoOcupacionPorNoche(d("2026-08-01"), d("2026-08-05"), reservas, bloqueos)).toBe(3);
  });

  it("bloqueo y reserva asignada al mismo cuarto no cuentan doble", () => {
    const reservas = [reserva("2026-08-01", "2026-08-03", "h1")];
    const bloqueos = [bloqueo("h1", "2026-08-01", "2026-08-03")];
    expect(picoOcupacionPorNoche(d("2026-08-01"), d("2026-08-03"), reservas, bloqueos)).toBe(1);
  });

  it("reservas back-to-back (checkout = checkin) no se solapan", () => {
    const reservas = [reserva("2026-08-01", "2026-08-03"), reserva("2026-08-03", "2026-08-05")];
    expect(picoOcupacionPorNoche(d("2026-08-01"), d("2026-08-05"), reservas, [])).toBe(1);
  });

  it("el pico es el máximo de UNA noche, no la suma de todas", () => {
    // Tres reservas de una noche cada una, en noches distintas
    const reservas = [
      reserva("2026-08-01", "2026-08-02"),
      reserva("2026-08-02", "2026-08-03"),
      reserva("2026-08-03", "2026-08-04"),
    ];
    expect(picoOcupacionPorNoche(d("2026-08-01"), d("2026-08-04"), reservas, [])).toBe(1);
  });

  it("reserva que envuelve todo el rango consultado cuenta cada noche", () => {
    const reservas = [reserva("2026-07-28", "2026-08-10")];
    expect(picoOcupacionPorNoche(d("2026-08-01"), d("2026-08-03"), reservas, [])).toBe(1);
  });
});
