import { describe, expect, it, vi } from "vitest";
import {
  construirReporteMigracion,
  ejecutarMigracion,
  validarGuardasCli,
  type FilaPagoManualLegacy,
  type PagoExternoMigrable,
} from "./migrate-external-payment-ledger";

const fechaPago = new Date("2026-08-14T12:00:00.000Z");

function fila(overrides: Partial<FilaPagoManualLegacy> = {}): FilaPagoManualLegacy {
  return {
    pagoManualId: "manual_1",
    reservaId: "reserva_1",
    propiedadId: "propiedad_1",
    estado: "ANTICIPO_PAGADO",
    montoAnticipoCentavos: 200_000,
    totalCentavos: 600_000,
    fechaPago,
    nota: null,
    pagosStripe: [],
    pagosExternos: [],
    pagoExternoMigradoId: null,
    ...overrides,
  };
}

describe("construirReporteMigracion", () => {
  it("clasifica cada fila sin exponer notas ni datos fuera del reporte seguro", () => {
    const reporte = construirReporteMigracion([
      fila({ nota: "nota privada" }),
      fila({
        pagoManualId: "manual_2",
        reservaId: "reserva_2",
        estado: "PENDIENTE",
        montoAnticipoCentavos: null,
      }),
      fila({
        pagoManualId: "manual_3",
        reservaId: "reserva_3",
        montoAnticipoCentavos: 0,
      }),
      fila({
        pagoManualId: "manual_4",
        reservaId: "reserva_4",
        pagoExternoMigradoId: "externo_4",
        pagosExternos: [{ cobradoCentavos: 200_000, ajustesCentavos: 0 }],
      }),
    ]);

    expect(reporte.filas.map((item) => item.clasificacion)).toEqual([
      "CONCILIABLE",
      "SIN_MOVIMIENTO",
      "REVISION_MANUAL",
      "YA_MIGRADO",
    ]);
    expect(reporte.filas[0]).toEqual({
      pagoManualId: "manual_1",
      reservaId: "reserva_1",
      propiedadId: "propiedad_1",
      clasificacion: "CONCILIABLE",
      totalReservaCentavos: 600_000,
      stripeNetoCentavos: 0,
      externoActualCentavos: 0,
      montoMigracionCentavos: 200_000,
      pagadoProyectadoCentavos: 200_000,
      diferenciaCentavos: 0,
    });
    expect(JSON.stringify(reporte)).not.toContain("nota privada");
  });
});

describe("ejecutarMigracion", () => {
  it("mantiene dry-run como default y no llama al escritor", async () => {
    const insertarSiAusente = vi.fn<(pago: PagoExternoMigrable) => Promise<string | null>>();

    const reporte = await ejecutarMigracion([fila({ nota: "nota privada" })], {
      aplicar: false,
      insertarSiAusente,
    });

    expect(insertarSiAusente).not.toHaveBeenCalled();
    expect(reporte.filas[0].clasificacion).toBe("CONCILIABLE");
  });

  it("aplica una vez y una segunda ejecución no duplica el pago", async () => {
    const pagos = new Map<string, string>();
    const insertarSiAusente = vi.fn(async (pago: PagoExternoMigrable) => {
      if (pagos.has(pago.idempotencyKey)) return null;
      pagos.set(pago.idempotencyKey, "externo_1");
      return "externo_1";
    });

    const primera = await ejecutarMigracion([fila()], { aplicar: true, insertarSiAusente });
    const segunda = await ejecutarMigracion([fila()], { aplicar: true, insertarSiAusente });

    expect(primera.filas[0]).toMatchObject({ clasificacion: "APLICADO", pagoExternoId: "externo_1" });
    expect(segunda.filas[0].clasificacion).toBe("YA_MIGRADO");
    expect(pagos.size).toBe(1);
    expect(insertarSiAusente.mock.calls[0][0].idempotencyKey).toBe(
      "legacy-pago-manual:manual_1"
    );
  });
});

describe("validarGuardasCli", () => {
  it("exige el acknowledgement exacto para --apply", () => {
    expect(() => validarGuardasCli(["--apply"], "sk_test_123")).toThrow(
      "APPLY_REQUIERE_--sandbox-confirmed"
    );
    expect(() => validarGuardasCli(["--apply", "--sandbox-confirmed=true"], "sk_test_123"))
      .toThrow("APPLY_REQUIERE_--sandbox-confirmed");
    expect(validarGuardasCli(["--apply", "--sandbox-confirmed"], "sk_test_123")).toEqual({
      aplicar: true,
    });
  });

  it("rechaza Stripe Live salvo con el guard explícito", () => {
    expect(() => validarGuardasCli([], "sk_live_123")).toThrow(
      "STRIPE_LIVE_REQUIERE_--allow-live"
    );
    expect(validarGuardasCli(["--allow-live"], "sk_live_123")).toEqual({ aplicar: false });
  });
});
