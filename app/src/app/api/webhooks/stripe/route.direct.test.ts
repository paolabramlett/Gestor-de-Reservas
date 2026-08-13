import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  refundsCreate: vi.fn(),
  paymentIntentRetrieve: vi.fn(),
  propiedadFindUnique: vi.fn(),
  tipoFindFirst: vi.fn(),
  tipoFindUnique: vi.fn(),
  reservaFindUnique: vi.fn(),
  reservaCreate: vi.fn(),
  huespedCreate: vi.fn(),
  pagoOnlineCreate: vi.fn(),
  verificarDisponibilidad: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: mocks.constructEvent },
    refunds: { create: mocks.refundsCreate },
    paymentIntents: { retrieve: mocks.paymentIntentRetrieve },
  },
}));

vi.mock("@/lib/prisma", () => {
  const tx = {
    reserva: {
      findUnique: mocks.reservaFindUnique,
      create: mocks.reservaCreate,
    },
    huesped: { create: mocks.huespedCreate },
    pagoOnline: { create: mocks.pagoOnlineCreate },
  };
  return {
    prisma: {
      propiedad: { findUnique: mocks.propiedadFindUnique },
      tipoDeHabitacion: {
        findFirst: mocks.tipoFindFirst,
        findUnique: mocks.tipoFindUnique,
      },
      reserva: { findUnique: mocks.reservaFindUnique },
      $transaction: (callback: (client: typeof tx) => unknown) => callback(tx),
    },
  };
});

vi.mock("@/lib/negocio/tarifas", () => ({
  calcularTotalReserva: vi.fn().mockResolvedValue({ total: 1_000, desglose: [] }),
}));

vi.mock("@/lib/negocio/disponibilidad", () => ({
  bloquearInventarioTipo: vi.fn().mockResolvedValue(undefined),
  calcularDisponibilidad: vi.fn(),
  verificarDisponibilidadAtómica: mocks.verificarDisponibilidad,
}));

vi.mock("@/lib/negocio/intentosPago", () => ({
  exigirIntentoPagoAutorizado: vi.fn().mockResolvedValue({
    datosReserva: {
      tipoDeHabitacionId: "tipo_1",
      nombre: "Ana Pérez",
      email: "ana@example.com",
      telefono: "",
      fechaIngreso: "2026-09-10",
      fechaSalida: "2026-09-12",
      numPersonas: 2,
    },
  }),
  marcarIntentoPagoPagado: vi.fn().mockResolvedValue(undefined),
  obtenerIntentoPago: vi.fn().mockResolvedValue({ stripeConnectAccountId: "acct_hotel" }),
}));

vi.mock("@/lib/emails", () => ({
  enviarConfirmacion: vi.fn().mockResolvedValue(undefined),
  enviarAlertaEquipo: vi.fn().mockResolvedValue(undefined),
  enviarPagoFallido: vi.fn().mockResolvedValue(undefined),
  enviarSolicitudPago: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";

const cuentaConnect = "acct_hotel";

function paymentIntentEvent(account: string | null = cuentaConnect): Stripe.Event {
  return {
    id: "evt_directo",
    object: "event",
    ...(account ? { account } : {}),
    api_version: "2026-06-24.dahlia",
    created: 1,
    data: {
      object: {
        id: "pi_directo",
        object: "payment_intent",
        amount_received: 100_000,
        currency: "mxn",
        status: "succeeded",
        metadata: {
          propiedadId: "prop_1",
          tipoDeHabitacionId: "tipo_1",
          nombre: "Ana Pérez",
          email: "ana@example.com",
          telefono: "",
          fechaIngreso: "2026-09-10",
          fechaSalida: "2026-09-12",
          numPersonas: "2",
          montoEsperadoCentavos: "100000",
        },
      } as unknown as Stripe.PaymentIntent,
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "payment_intent.succeeded",
  } as Stripe.Event;
}

function request() {
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: "{}",
    headers: { "stripe-signature": "firma" },
  });
}

describe("payment_intent.succeeded de una reserva pública directa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET_CONNECT = "whsec_connect_test";
    process.env.STRIPE_SECRET_KEY = "sk_test_unit";
    mocks.constructEvent.mockReturnValue(paymentIntentEvent());
    mocks.propiedadFindUnique.mockResolvedValue({
      id: "prop_1",
      nombre: "Casa Canteras",
      email: null,
      colorPrimario: null,
      stripeConnectAccountId: cuentaConnect,
    });
    mocks.tipoFindFirst.mockResolvedValue({ capacidadMin: 1, capacidadMax: 2 });
    mocks.tipoFindUnique.mockResolvedValue({ nombre: "Suite" });
    mocks.reservaFindUnique.mockResolvedValue(null);
    mocks.verificarDisponibilidad.mockResolvedValue(true);
    mocks.huespedCreate.mockResolvedValue({ id: "huesped_1" });
    mocks.reservaCreate.mockResolvedValue({
      id: "reserva_1",
      codigoReserva: "RES-AAAA-BBBB",
      totalMxn: 1_000,
    });
    mocks.pagoOnlineCreate.mockResolvedValue({ id: "pago_1" });
  });

  it("rechaza un evento Connect aunque tenga firma válida del endpoint de Roomly", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_plataforma";
    delete process.env.STRIPE_WEBHOOK_SECRET_CONNECT;

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Origen de webhook incorrecto" });
    expect(mocks.reservaCreate).not.toHaveBeenCalled();
  });

  it("rechaza eventos Live cuando Roomly está usando claves Test", async () => {
    const event = paymentIntentEvent();
    event.livemode = true;
    mocks.constructEvent.mockReturnValue(event);

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Modo de webhook incorrecto" });
    expect(mocks.reservaCreate).not.toHaveBeenCalled();
  });

  it("crea una sola Reserva y un solo PagoOnline con la cuenta y el modelo DIRECT", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.reservaCreate).toHaveBeenCalledTimes(1);
    expect(mocks.pagoOnlineCreate).toHaveBeenCalledTimes(1);
    expect(mocks.pagoOnlineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reservaId: "reserva_1",
        stripePaymentIntentId: "pi_directo",
        modeloCobro: "DIRECT",
        stripeConnectAccountId: cuentaConnect,
      }),
    });
  });

  it("no confirma la Reserva cuando un evento Connect llega sin account", async () => {
    mocks.constructEvent.mockReturnValue(paymentIntentEvent(null));

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.reservaCreate).not.toHaveBeenCalled();
    expect(mocks.pagoOnlineCreate).not.toHaveBeenCalled();
  });

  it("no confirma la Reserva cuando el account pertenece a otra Propiedad", async () => {
    mocks.constructEvent.mockReturnValue(paymentIntentEvent("acct_otro_hotel"));

    await expect(POST(request())).rejects.toThrow("CUENTA_EVENTO_STRIPE_INCONSISTENTE");

    expect(mocks.reservaCreate).not.toHaveBeenCalled();
    expect(mocks.pagoOnlineCreate).not.toHaveBeenCalled();
  });

  it("reembolsa la falta de disponibilidad dentro de la cuenta conectada", async () => {
    mocks.verificarDisponibilidad.mockResolvedValue(false);
    mocks.refundsCreate.mockResolvedValue({ id: "re_1" });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reembolsado: true });
    expect(mocks.refundsCreate).toHaveBeenCalledWith({
      payment_intent: "pi_directo",
    }, {
      stripeAccount: cuentaConnect,
      idempotencyKey: "roomly-no-availability-pi_directo",
    });
    expect(mocks.refundsCreate.mock.calls[0][0]).not.toHaveProperty("reverse_transfer");
  });

  it("mantiene compatibilidad con eventos históricos de destination charges", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_plataforma";
    delete process.env.STRIPE_WEBHOOK_SECRET_CONNECT;
    const event = paymentIntentEvent(null);
    (event.data.object as Stripe.PaymentIntent).transfer_data = {
      destination: cuentaConnect,
    } as Stripe.PaymentIntent.TransferData;
    mocks.constructEvent.mockReturnValue(event);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.pagoOnlineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        modeloCobro: "DESTINATION_LEGACY",
        stripeConnectAccountId: null,
      }),
    });
  });
});
