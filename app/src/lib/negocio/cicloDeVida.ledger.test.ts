import { beforeEach, describe, expect, it, vi } from "vitest";

const { findFirst, update, updateMany, reembolsarPagosOnline } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  reembolsarPagosOnline: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    reserva: { findFirst, update, updateMany },
  },
}));
vi.mock("@/lib/negocio/pagosOnline", () => ({ reembolsarPagosOnline }));
vi.mock("@/lib/emails", () => ({ enviarCancelacion: vi.fn().mockResolvedValue(undefined) }));

import { cancelarReserva, checkIn, tieneEliminacionSegura } from "./cicloDeVida";

function reservaConLedger(saldoReabierto = false) {
  return {
    id: "res_1",
    propiedadId: "prop_1",
    estado: "CONFIRMADA",
    origen: "MANUAL",
    totalMxn: 6_000,
    asignacion: { id: "asig_1" },
    pagosOnline: [{
      id: "po_1",
      montoMxn: 3_000,
      montoReembolsadoMxn: saldoReabierto ? 1_000 : 0,
      reembolsoPendienteMxn: 0,
      creadoEn: new Date("2026-08-01"),
    }],
    pagosExternos: [{
      id: "pe_1",
      montoMxn: 3_000,
      ajustes: [],
    }],
  };
}

describe("ciclo de vida con ledger financiero", () => {
  beforeEach(() => {
    findFirst.mockReset();
    update.mockReset();
    updateMany.mockReset();
    reembolsarPagosOnline.mockReset();
    update.mockResolvedValue({ id: "res_1", estado: "EN_CURSO" });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("check-in acepta Stripe 3000 + transferencia 3000 para total 6000", async () => {
    findFirst.mockResolvedValue(reservaConLedger());

    await expect(checkIn("res_1", "prop_1")).resolves.toMatchObject({ estado: "EN_CURSO" });
  });

  it("check-in rechaza un saldo reabierto por reembolso", async () => {
    findFirst.mockResolvedValue(reservaConLedger(true));

    await expect(checkIn("res_1", "prop_1")).rejects.toThrow("$1,000");
  });

  it("check-in usa el neto corregido y muestra el saldo pendiente exacto", async () => {
    findFirst.mockResolvedValue({
      ...reservaConLedger(),
      pagosExternos: [
        {
          id: "pe_original",
          montoMxn: 2_000,
          ajustes: [{ tipo: "ANULACION", montoMxn: 2_000 }],
        },
        {
          id: "pe_reemplazo",
          montoMxn: 1_500,
          ajustes: [],
        },
      ],
    });

    await expect(checkIn("res_1", "prop_1")).rejects.toThrow("$1,500");
    expect(update).not.toHaveBeenCalled();
  });

  it("una reserva con movimientos externos no se puede eliminar aunque su neto sea cero", () => {
    expect(tieneEliminacionSegura({
      tienePagosStripe: false,
      tienePagosExternos: true,
      grupoPagadoCentavos: 0,
    })).toBe(false);
  });

  it("cancelación total reembolsa sólo el neto Stripe y no los pagos externos", async () => {
    findFirst.mockResolvedValue({
      ...reservaConLedger(),
      stripePaymentIntentId: "pi_1",
      codigoReserva: "RES-1",
      nombreHuesped: "Ana",
      fechaIngreso: new Date("2026-09-01"),
      fechaSalida: new Date("2026-09-02"),
      huesped: { nombre: "Ana", email: "ana@example.com" },
      tipoDeHabitacion: { nombre: "Suite" },
      propiedad: { nombre: "Hotel", colorPrimario: null },
    });

    await cancelarReserva({
      reservaId: "res_1",
      propiedadId: "prop_1",
      politicaReembolso: "TOTAL",
    });

    expect(reembolsarPagosOnline).toHaveBeenCalledWith({ reservaId: "res_1", montoMxn: 3_000 });
  });
});
