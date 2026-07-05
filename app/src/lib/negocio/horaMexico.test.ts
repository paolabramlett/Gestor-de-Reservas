import { describe, it, expect, vi, afterEach } from "vitest";
import { horaMexicoAUtc, hoyEnMexico } from "./horaMexico";

describe("horaMexicoAUtc", () => {
  it("convierte una hora de pared de México a su instante UTC (+6h)", () => {
    const fecha = new Date("2026-07-10T00:00:00.000Z");
    expect(horaMexicoAUtc(fecha, "15:00").toISOString()).toBe("2026-07-10T21:00:00.000Z");
  });

  it("funciona con medianoche", () => {
    const fecha = new Date("2026-07-10T00:00:00.000Z");
    expect(horaMexicoAUtc(fecha, "00:00").toISOString()).toBe("2026-07-10T06:00:00.000Z");
  });
});

describe("hoyEnMexico", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("a las 11pm UTC (5pm México) todavía es el mismo día en México", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T23:00:00.000Z"));
    expect(hoyEnMexico().toISOString()).toBe("2026-07-10T06:00:00.000Z");
  });

  it("a las 2am UTC (8pm México del día anterior) sigue siendo el día anterior en México", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T02:00:00.000Z"));
    expect(hoyEnMexico().toISOString()).toBe("2026-07-10T06:00:00.000Z");
  });

  it("a las 7am UTC (1am México) ya es el nuevo día en México", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-11T07:00:00.000Z"));
    expect(hoyEnMexico().toISOString()).toBe("2026-07-11T06:00:00.000Z");
  });
});
