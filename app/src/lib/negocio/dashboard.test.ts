import { describe, expect, it } from "vitest";
import { esHuespedEnCasa, inicioDiaCalendarioUtc } from "./dashboard";

describe("estado En casa del dashboard", () => {
  const hoy = new Date("2026-08-24T06:00:00.000Z");

  it("excluye reservas cuyo check-out ya pasó", () => {
    expect(esHuespedEnCasa({
      estado: "EN_CURSO",
      fechaIngreso: new Date("2026-07-06T06:00:00.000Z"),
      fechaSalida: new Date("2026-07-08T06:00:00.000Z"),
    }, hoy)).toBe(false);
  });

  it("incluye una reserva que está dentro de su estancia", () => {
    expect(esHuespedEnCasa({
      estado: "EN_CURSO",
      fechaIngreso: new Date("2026-08-20T06:00:00.000Z"),
      fechaSalida: new Date("2026-08-26T06:00:00.000Z"),
    }, hoy)).toBe(true);
  });

  it("convierte hoy local en el inicio del día de calendario almacenado", () => {
    expect(inicioDiaCalendarioUtc(hoy).toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });
});
