import { describe, expect, it } from "vitest";
import { resumirMovimientos } from "./reportePagos";

describe("resumirMovimientos", () => {
  it("suma ingresos por fecha y fuente del movimiento", () => {
    const periodo = {
      inicio: new Date("2026-08-01T00:00:00.000Z"),
      fin: new Date("2026-08-31T23:59:59.999Z"),
    };
    const movimientos = [
      { fecha: new Date("2026-08-02T12:00:00.000Z"), fuente: "STRIPE" as const, montoCentavos: 300_000 },
      { fecha: new Date("2026-08-03T12:00:00.000Z"), fuente: "EFECTIVO" as const, montoCentavos: 100_000 },
      { fecha: new Date("2026-08-04T12:00:00.000Z"), fuente: "TRANSFERENCIA" as const, montoCentavos: 200_000 },
      { fecha: new Date("2026-07-31T23:59:59.999Z"), fuente: "TERMINAL_EXTERNA" as const, montoCentavos: 900_000 },
    ];

    expect(resumirMovimientos(periodo, movimientos)).toEqual({
      stripeCentavos: 300_000,
      efectivoCentavos: 100_000,
      transferenciaCentavos: 200_000,
      terminalExternaCentavos: 0,
      otrosCentavos: 0,
      netoCentavos: 600_000,
    });
  });

  it("resta reembolsos en la fecha del reembolso", () => {
    const periodoAgosto = {
      inicio: new Date("2026-08-01T00:00:00.000Z"),
      fin: new Date("2026-08-31T23:59:59.999Z"),
    };

    expect(resumirMovimientos(periodoAgosto, [
      { fecha: new Date("2026-07-31T12:00:00.000Z"), fuente: "TRANSFERENCIA", montoCentavos: 200_000 },
      { fecha: new Date("2026-08-11T12:00:00.000Z"), fuente: "TRANSFERENCIA", montoCentavos: -50_000 },
    ])).toMatchObject({
      transferenciaCentavos: -50_000,
      netoCentavos: -50_000,
    });
  });

  it("rechaza movimientos que no estén expresados en centavos enteros seguros", () => {
    const periodo = {
      inicio: new Date("2026-08-01T00:00:00.000Z"),
      fin: new Date("2026-08-31T23:59:59.999Z"),
    };

    expect(() => resumirMovimientos(periodo, [
      { fecha: new Date("2026-08-10T12:00:00.000Z"), fuente: "STRIPE", montoCentavos: 100.5 },
    ])).toThrow("CENTAVOS_INVALIDOS");
  });

  it("rechaza totales que exceden los centavos enteros seguros", () => {
    const periodo = {
      inicio: new Date("2026-08-01T00:00:00.000Z"),
      fin: new Date("2026-08-31T23:59:59.999Z"),
    };

    expect(() => resumirMovimientos(periodo, [
      { fecha: new Date("2026-08-10T12:00:00.000Z"), fuente: "OTRO", montoCentavos: Number.MAX_SAFE_INTEGER },
      { fecha: new Date("2026-08-11T12:00:00.000Z"), fuente: "OTRO", montoCentavos: 1 },
    ])).toThrow("CENTAVOS_INVALIDOS");
  });
});
