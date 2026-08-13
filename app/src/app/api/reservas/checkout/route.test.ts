import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { paymentIntentCreate } = vi.hoisted(() => ({ paymentIntentCreate: vi.fn() }));

vi.mock("@/lib/rateLimit", () => ({ rateLimit: () => true }));
vi.mock("@/lib/stripe", () => ({
  stripe: { paymentIntents: { create: paymentIntentCreate } },
}));
vi.mock("@/lib/negocio/tarifas", () => ({
  calcularTotalReserva: () => Promise.resolve({ total: 1_000 }),
}));
vi.mock("@/lib/negocio/disponibilidad", () => ({
  verificarDisponibilidadAtómica: () => Promise.resolve(true),
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
      findFirst: () => Promise.resolve({ capacidadMin: 1, capacidadMax: 2 }),
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
  tipoDeHabitacionId: "tipo_1",
  nombre: "Ana Pérez",
  email: "ana@example.com",
  telefono: "5551234567",
  fechaIngreso: "2026-09-10",
  fechaSalida: "2026-09-12",
  numPersonas: 2,
  intentoId: "11111111-1111-4111-8111-111111111111",
};

describe("POST /api/reservas/checkout", () => {
  beforeEach(() => {
    paymentIntentCreate.mockReset();
    paymentIntentCreate.mockResolvedValue({ id: "pi_hotel", client_secret: "pi_secret" });
  });

  it("crea el PaymentIntent en la cuenta del hotel y devuelve ese contexto al PaymentElement", async () => {
    const response = await POST(new NextRequest("http://localhost/api/reservas/checkout", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      clientSecret: "pi_secret",
      stripeAccountId: "acct_hotel",
    });

    const [params, options] = paymentIntentCreate.mock.calls[0];
    expect(params).toMatchObject({
      amount: 100_000,
      currency: "mxn",
      metadata: { stripeConnectAccountId: "acct_hotel" },
    });
    expect(params).not.toHaveProperty("transfer_data");
    expect(params).not.toHaveProperty("application_fee_amount");
    expect(options).toEqual({
      stripeAccount: "acct_hotel",
      idempotencyKey: expect.stringMatching(/^roomly-direct-reserva-publica-[a-f0-9]{64}$/),
    });
  });

  it("genera la misma clave de idempotencia para el mismo intento lógico", async () => {
    const crearRequest = () => new NextRequest("http://localhost/api/reservas/checkout", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });

    await POST(crearRequest());
    await POST(crearRequest());

    expect(paymentIntentCreate.mock.calls[0][1].idempotencyKey)
      .toBe(paymentIntentCreate.mock.calls[1][1].idempotencyKey);
  });

  it("genera otra clave para una compra nueva aunque la reserva tenga los mismos datos", async () => {
    const crearRequest = (intentoId: string) => new NextRequest("http://localhost/api/reservas/checkout", {
      method: "POST",
      body: JSON.stringify({ ...body, intentoId }),
      headers: { "content-type": "application/json" },
    });

    await POST(crearRequest("11111111-1111-4111-8111-111111111111"));
    await POST(crearRequest("22222222-2222-4222-8222-222222222222"));

    expect(paymentIntentCreate.mock.calls[0][1].idempotencyKey)
      .not.toBe(paymentIntentCreate.mock.calls[1][1].idempotencyKey);
  });
});
