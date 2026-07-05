import { describe, it, expect } from "vitest";
import { calcularEtapaAlerta, horaCheckInEsperada } from "./alertasCheckIn";

const FECHA_INGRESO = new Date("2026-07-10T00:00:00.000Z");

describe("horaCheckInEsperada", () => {
  it("combina la fecha de la reserva con la hora de check-in del hotel (hora de México, UTC-6)", () => {
    const esperada = horaCheckInEsperada(FECHA_INGRESO, "15:00");
    expect(esperada.toISOString()).toBe("2026-07-10T21:00:00.000Z");
  });
});

describe("calcularEtapaAlerta", () => {
  const base = {
    fechaIngreso: FECHA_INGRESO,
    horaCheckIn: "15:00", // 15:00 México = 21:00 UTC
    horasParaLateCheckIn: 2,
    horasParaNoShow: 6,
  };

  it("devuelve null antes de la hora de check-in", () => {
    const ahora = new Date("2026-07-10T20:59:00.000Z");
    expect(calcularEtapaAlerta({ ...base, ahora })).toBeNull();
  });

  it("devuelve SIN_LLEGAR justo al pasar la hora de check-in", () => {
    const ahora = new Date("2026-07-10T21:01:00.000Z");
    expect(calcularEtapaAlerta({ ...base, ahora })).toBe("SIN_LLEGAR");
  });

  it("devuelve SIN_LLEGAR minutos antes del umbral de late check-in", () => {
    const ahora = new Date("2026-07-10T22:59:00.000Z");
    expect(calcularEtapaAlerta({ ...base, ahora })).toBe("SIN_LLEGAR");
  });

  it("devuelve SUGERIR_LATE_CHECKIN exactamente al llegar al umbral", () => {
    const ahora = new Date("2026-07-10T23:00:00.000Z");
    expect(calcularEtapaAlerta({ ...base, ahora })).toBe("SUGERIR_LATE_CHECKIN");
  });

  it("devuelve SUGERIR_LATE_CHECKIN minutos antes del umbral de no-show", () => {
    const ahora = new Date("2026-07-11T02:59:00.000Z");
    expect(calcularEtapaAlerta({ ...base, ahora })).toBe("SUGERIR_LATE_CHECKIN");
  });

  it("devuelve SUGERIR_NO_SHOW exactamente al llegar al umbral de no-show", () => {
    const ahora = new Date("2026-07-11T03:00:00.000Z");
    expect(calcularEtapaAlerta({ ...base, ahora })).toBe("SUGERIR_NO_SHOW");
  });

  it("devuelve SUGERIR_NO_SHOW mucho después", () => {
    const ahora = new Date("2026-07-11T15:00:00.000Z");
    expect(calcularEtapaAlerta({ ...base, ahora })).toBe("SUGERIR_NO_SHOW");
  });

  it("con horasParaLateCheckIn = 0, sugiere late check-in de inmediato", () => {
    const ahora = new Date("2026-07-10T21:00:01.000Z");
    expect(calcularEtapaAlerta({ ...base, horasParaLateCheckIn: 0, ahora })).toBe("SUGERIR_LATE_CHECKIN");
  });
});
