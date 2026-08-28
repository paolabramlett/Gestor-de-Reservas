import { describe, expect, it } from "vitest";
import { debeMarcarNoShow, puedeSolicitarPagoPorFecha } from "./vencimientoPagos";

describe("vencimiento de cobros", () => {
  it("bloquea solicitar pago después del checkout del hotel", () => {
    expect(puedeSolicitarPagoPorFecha({ estado: "CONFIRMADA", fechaSalida: new Date("2026-07-08T00:00:00Z"), horaCheckOut: "12:00", ahora: new Date("2026-08-28T18:00:00Z") })).toBe(false);
  });

  it("permite cobrar antes del checkout y bloquea estados terminales", () => {
    const fecha = new Date("2026-08-28T00:00:00Z");
    expect(puedeSolicitarPagoPorFecha({ estado: "EN_CURSO", fechaSalida: fecha, horaCheckOut: "12:00", ahora: new Date("2026-08-28T15:00:00Z") })).toBe(true);
    expect(puedeSolicitarPagoPorFecha({ estado: "COMPLETADA", fechaSalida: fecha, horaCheckOut: "12:00", ahora: new Date("2026-08-27T15:00:00Z") })).toBe(false);
  });

  it("marca no-show sólo cuando vence la tolerancia", () => {
    const base = { estado: "CONFIRMADA", fechaIngreso: new Date("2026-08-24T00:00:00Z"), horaCheckIn: "15:00", horasParaNoShow: 6 };
    expect(debeMarcarNoShow({ ...base, ahora: new Date("2026-08-25T02:59:00Z") })).toBe(false);
    expect(debeMarcarNoShow({ ...base, ahora: new Date("2026-08-25T03:00:00Z") })).toBe(true);
  });
});
