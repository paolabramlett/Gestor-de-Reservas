import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  executeRaw: vi.fn(),
  checkoutCreate: vi.fn(),
  redirect: vi.fn((url: string) => { throw new Error(`REDIRECT:${url}`); }),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUsuario: () => Promise.resolve({ id: "up_1", propiedadId: "prop_1" }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/prisma", () => {
  const tx = {
    $executeRaw: mocks.executeRaw,
    reserva: { findFirst: mocks.findFirst },
  };
  return {
    prisma: {
      $transaction: (trabajo: (cliente: typeof tx) => unknown) => trabajo(tx),
      reserva: { findFirst: mocks.findFirst, update: vi.fn().mockResolvedValue({}) },
      intentoDePagoStripe: { findUnique: vi.fn().mockResolvedValue(null) },
    },
  };
});
vi.mock("@/lib/stripe", () => ({
  stripe: { checkout: { sessions: { create: mocks.checkoutCreate, expire: vi.fn() } } },
}));
vi.mock("@/lib/emails", () => ({ enviarSolicitudPago: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/stripeConnect", () => ({
  crearDirectCharge: () => ({
    stripeAccountId: "acct_1",
    paymentIntentData: {},
    requestOptions: { stripeAccount: "acct_1" },
  }),
  crearClaveIdempotenciaDirectCharge: () => "idem_1",
  mensajeErrorConnect: (error: Error) => error.message,
}));
vi.mock("@/lib/stripeConnectAccount.server", () => ({
  validarCuentaConnectParaCobroDirecto: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/negocio/intentosPago", () => ({
  registrarIntentoPago: vi.fn().mockResolvedValue(undefined),
  asociarIntentoPagoStripe: vi.fn().mockResolvedValue(undefined),
}));

import { solicitarPagoAction } from "./actions";

describe("solicitarPagoAction con ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkoutCreate.mockResolvedValue({ id: "cs_1", url: "https://pago.test" });
    mocks.findFirst.mockResolvedValue({
      id: "res_1",
      propiedadId: "prop_1",
      codigoReserva: "RES-1",
      estado: "CONFIRMADA",
      origen: "MANUAL",
      tipoEspecial: null,
      totalMxn: 6_000,
      stripeCheckoutSessionId: null,
      huesped: { nombre: "Ana", email: "ana@example.com" },
      tipoDeHabitacion: { nombre: "Suite" },
      propiedad: {
        nombre: "Hotel",
        slug: "hotel",
        colorPrimario: null,
        stripeConnectAccountId: "acct_1",
        stripeConnectHabilitado: true,
      },
      pagosOnline: [{ montoMxn: 2_000, montoReembolsadoMxn: 0, reembolsoPendienteMxn: 0 }],
      pagosExternos: [{ montoMxn: 1_000, ajustes: [] }],
      fechaIngreso: new Date("2026-09-01"),
      fechaSalida: new Date("2026-09-02"),
      numPersonas: 2,
    });
  });

  it("recalcula bajo lock y cobra únicamente el saldo central", async () => {
    await expect(solicitarPagoAction("res_1")).rejects.toThrow("REDIRECT:");

    expect(mocks.executeRaw).toHaveBeenCalledOnce();
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [expect.objectContaining({
          price_data: expect.objectContaining({ unit_amount: 300_000 }),
        })],
      }),
      expect.objectContaining({ stripeAccount: "acct_1" })
    );
  });
});
