import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  findUniqueOrThrow: vi.fn(),
  reembolsarPagosOnline: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({ rateLimit: () => true }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    grupoReserva: { findFirst: vi.fn() },
    reserva: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
      findUniqueOrThrow: mocks.findUniqueOrThrow,
    },
    pagoOnline: { aggregate: vi.fn() },
  },
}));
vi.mock("@/lib/negocio/pagosOnline", () => ({
  reembolsarPagosOnline: mocks.reembolsarPagosOnline,
}));
vi.mock("@/lib/emails", () => ({ enviarCancelacion: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";

describe("POST /api/reservas/cancelar con ledger", () => {
  it("reembolsa sólo Stripe neto y deja visibles los movimientos externos", async () => {
    const reserva = {
      id: "res_1",
      codigoReserva: "RES-1",
      estado: "CONFIRMADA",
      origen: "ONLINE",
      fechaIngreso: new Date(Date.now() + 10 * 86_400_000),
      fechaSalida: new Date(Date.now() + 12 * 86_400_000),
      totalMxn: 6_000,
      stripePaymentIntentId: "pi_1",
      pagosOnline: [{ montoMxn: 3_000, montoReembolsadoMxn: 1_000, reembolsoPendienteMxn: 0 }],
      pagosExternos: [{ montoMxn: 4_000, ajustes: [{ tipo: "REEMBOLSO", montoMxn: 1_000 }] }],
    };
    mocks.findFirst.mockResolvedValue(reserva);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findUniqueOrThrow.mockResolvedValue({
      ...reserva,
      nombreHuesped: "Ana",
      huesped: { nombre: "Ana", email: "ana@example.com" },
      propiedad: { nombre: "Hotel", colorPrimario: null },
    });

    const response = await POST(new NextRequest("http://localhost/api/reservas/cancelar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ codigo: "RES-1", email: "ana@example.com" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      montoReembolso: 2_000,
      pagosExternosMxn: 4_000,
      reembolsosExternosMxn: 1_000,
    });
    expect(mocks.reembolsarPagosOnline).toHaveBeenCalledWith({
      reservaId: "res_1",
      montoMxn: 2_000,
    });
  });
});
