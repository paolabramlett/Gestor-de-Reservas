import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { sessionCreate } = vi.hoisted(() => ({ sessionCreate: vi.fn() }));

vi.mock("@/lib/rateLimit", () => ({ rateLimit: () => true }));
vi.mock("@/lib/stripe", () => ({ stripe: { checkout: { sessions: { create: sessionCreate } } } }));
vi.mock("@/lib/negocio/tarifas", () => ({
  calcularTotalReserva: () => Promise.resolve({ total: 1_000 }),
}));
vi.mock("@/lib/negocio/disponibilidad", () => ({
  calcularDisponibilidad: () => Promise.resolve(2),
}));
vi.mock("@/lib/auth", () => ({
  getPropiedadBySlug: () => Promise.resolve({
    id: "prop_1",
    nombre: "Casa Canteras",
    planActivo: "PRO",
    stripeConnectAccountId: "acct_hotel",
    stripeConnectHabilitado: true,
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    tipoDeHabitacion: {
      findFirst: () => Promise.resolve({
        id: "tipo_1",
        nombre: "Suite",
        capacidadMin: 1,
        capacidadMax: 2,
      }),
    },
  },
}));
vi.mock("@/lib/negocio/suscripciones", () => ({ tieneAccesoRoomly: () => true }));
vi.mock("@/lib/stripeConnectAccount.server", () => ({
  validarCuentaConnectParaCobroDirecto: () => Promise.resolve(),
}));
vi.mock("@/lib/negocio/intentosPago", () => ({
  registrarIntentoPago: () => Promise.resolve(),
  asociarIntentoPagoStripe: () => Promise.resolve(),
}));

import { POST } from "./route";

const body = {
  slug: "casa-canteras",
  nombre: "Ana Pérez",
  email: "ana@example.com",
  intentoId: "11111111-1111-4111-8111-111111111111",
  habitaciones: [
    { tipoDeHabitacionId: "tipo_1", fechaIngreso: "2026-09-10", fechaSalida: "2026-09-12", numPersonas: 2 },
    { tipoDeHabitacionId: "tipo_1", fechaIngreso: "2026-09-10", fechaSalida: "2026-09-12", numPersonas: 2 },
  ],
};

describe("POST /api/reservas/checkout-grupo", () => {
  beforeEach(() => {
    sessionCreate.mockReset();
    sessionCreate.mockResolvedValue({ id: "cs_grupo", url: "https://checkout.stripe.test/grupo" });
  });

  it("crea el Checkout en la cuenta del hotel sin saldo ni responsabilidad para Roomly", async () => {
    const response = await POST(new NextRequest("http://localhost/api/reservas/checkout-grupo", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.test/grupo" });

    const [params, options] = sessionCreate.mock.calls[0];
    expect(params.payment_intent_data).not.toHaveProperty("transfer_data");
    expect(params.payment_intent_data).not.toHaveProperty("application_fee_amount");
    expect(params.metadata).toMatchObject({
      propiedadId: "prop_1",
      stripeConnectAccountId: "acct_hotel",
      roomlyIntentoId: body.intentoId,
    });
    expect(options).toEqual({
      stripeAccount: "acct_hotel",
      idempotencyKey: expect.stringMatching(/^roomly-direct-reserva-grupo-[a-f0-9]{64}$/),
    });
  });
});
