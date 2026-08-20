import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/lib/rateLimit", () => ({ rateLimit: () => true }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    grupoReserva: { findFirst: vi.fn() },
    reserva: { findFirst },
  },
}));

import { GET } from "./route";

describe("GET /api/reservas/consulta con ledger", () => {
  it("expone estado, saldo y movimientos externos derivados sin tratar el total como pagado", async () => {
    findFirst.mockResolvedValue({
      id: "res_1",
      codigoReserva: "RES-1",
      estado: "CONFIRMADA",
      fechaIngreso: new Date(Date.now() + 10 * 86_400_000),
      fechaSalida: new Date(Date.now() + 12 * 86_400_000),
      totalMxn: 6_000,
      origen: "ONLINE",
      huesped: { nombre: "Ana", email: "ana@example.com" },
      tipoDeHabitacion: { nombre: "Suite" },
      pagosOnline: [{ montoMxn: 3_000, montoReembolsadoMxn: 1_000, reembolsoPendienteMxn: 0 }],
      pagosExternos: [{ montoMxn: 4_000, ajustes: [{ tipo: "REEMBOLSO", montoMxn: 1_000 }] }],
    });

    const response = await GET(new NextRequest(
      "http://localhost/api/reservas/consulta?codigo=RES-1&email=ana%40example.com"
    ));
    const body = await response.json();

    expect(body).toMatchObject({
      totalMxn: 6_000,
      estadoFinanciero: "PAGO_PARCIAL",
      saldoPendienteMxn: 1_000,
      pagadoStripeNetoMxn: 2_000,
      pagosExternosMxn: 4_000,
      reembolsosExternosMxn: 1_000,
      montoReembolso: 2_000,
    });
  });
});
