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
  reservaFindFirst: vi.fn(),
  reservaUpdate: vi.fn(),
  reservaCreate: vi.fn(),
  huespedCreate: vi.fn(),
  pagoOnlineCreate: vi.fn(),
  pagoOnlineFindUnique: vi.fn(),
  pagoOnlineUpdate: vi.fn(),
  executeRaw: vi.fn(),
  grupoFindFirst: vi.fn(),
  grupoFindUnique: vi.fn(),
  grupoUpdate: vi.fn(),
  reservaFindMany: vi.fn(),
  verificarDisponibilidad: vi.fn(),
  enviarComprobantePago: vi.fn().mockResolvedValue(undefined),
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
    $executeRaw: mocks.executeRaw,
    reserva: {
      findUnique: mocks.reservaFindUnique,
      findFirst: mocks.reservaFindFirst,
      findMany: mocks.reservaFindMany,
      update: mocks.reservaUpdate,
      create: mocks.reservaCreate,
    },
    huesped: { create: mocks.huespedCreate },
    pagoOnline: {
      create: mocks.pagoOnlineCreate,
      findUnique: mocks.pagoOnlineFindUnique,
    },
    grupoReserva: {
      findFirst: mocks.grupoFindFirst,
      update: mocks.grupoUpdate,
    },
  };
  return {
    prisma: {
      propiedad: { findUnique: mocks.propiedadFindUnique },
      tipoDeHabitacion: {
        findFirst: mocks.tipoFindFirst,
        findUnique: mocks.tipoFindUnique,
      },
      reserva: {
        findUnique: mocks.reservaFindUnique,
        findFirst: mocks.reservaFindFirst,
      },
      pagoOnline: {
        findUnique: mocks.pagoOnlineFindUnique,
        update: mocks.pagoOnlineUpdate,
      },
      grupoReserva: { findUnique: mocks.grupoFindUnique },
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
  enviarComprobantePago: mocks.enviarComprobantePago,
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

function checkoutManualEvent(): Stripe.Event {
  return {
    id: "evt_manual",
    object: "event",
    account: cuentaConnect,
    api_version: "2026-06-24.dahlia",
    created: 1,
    data: {
      object: {
        id: "cs_manual",
        object: "checkout.session",
        amount_total: 300_000,
        currency: "mxn",
        payment_intent: "pi_manual",
        payment_status: "paid",
        metadata: {
          tipo: "MANUAL_PAGO",
          propiedadId: "prop_1",
          reservaId: "res_manual",
          roomlyIntentoId: "intento_manual",
          montoEsperadoCentavos: "300000",
        },
      } as unknown as Stripe.Checkout.Session,
    },
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "checkout.session.completed",
  } as Stripe.Event;
}

function checkoutGroupPaymentEvent(): Stripe.Event {
  const event = checkoutManualEvent();
  event.id = "evt_grupo_pago";
  event.data.object = {
    ...(event.data.object as Stripe.Checkout.Session),
    id: "cs_grupo_pago",
    payment_intent: "pi_grupo_pago",
    metadata: {
      tipo: "GRUPO_PAGO",
      propiedadId: "prop_1",
      grupoId: "grupo_1",
      roomlyIntentoId: "intento_grupo",
      montoEsperadoCentavos: "300000",
    },
  } as Stripe.Checkout.Session;
  return event;
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

  it("envía el comprobante público con el importe cobrado y el resumen completo", async () => {
    await POST(request());

    expect(mocks.enviarComprobantePago).toHaveBeenCalledWith(expect.objectContaining({
      codigoReserva: "RES-AAAA-BBBB",
      montoRecibidoCentavos: 100_000,
      totalPagadoCentavos: 100_000,
      totalReservaCentavos: 100_000,
      saldoPendienteCentavos: 0,
    }));
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

  it("un pago manual parcial usa el amount real, recarga el ledger y toma el lock 19", async () => {
    mocks.constructEvent.mockReturnValue(checkoutManualEvent());
    mocks.paymentIntentRetrieve.mockResolvedValue({
      id: "pi_manual",
      transfer_data: null,
    });
    mocks.pagoOnlineFindUnique.mockResolvedValue(null);
    mocks.pagoOnlineCreate.mockResolvedValue({
      id: "pago_manual",
      montoMxn: 3_000,
      montoReembolsadoMxn: 0,
      reembolsoPendienteMxn: 0,
      stripeConnectAccountId: cuentaConnect,
      estado: "PAGADO",
    });
    mocks.reservaFindFirst
      .mockResolvedValueOnce({
        id: "res_manual",
        propiedadId: "prop_1",
        codigoReserva: "RES-MANUAL",
        estado: "PENDIENTE_PAGO",
        totalMxn: 6_000,
        fechaIngreso: new Date("2026-09-10T00:00:00Z"),
        fechaSalida: new Date("2026-09-12T00:00:00Z"),
        numPersonas: 2,
        huesped: { nombre: "Ana Pérez", email: "ana@example.com", telefono: null },
        tipoDeHabitacion: { nombre: "Suite" },
        propiedad: { nombre: "Casa Canteras", email: null, colorPrimario: null },
        pagosOnline: [],
        pagosExternos: [],
      })
      .mockResolvedValueOnce({
        id: "res_manual",
        propiedadId: "prop_1",
        codigoReserva: "RES-MANUAL",
        totalMxn: 6_000,
        fechaIngreso: new Date("2026-09-10T00:00:00Z"),
        fechaSalida: new Date("2026-09-12T00:00:00Z"),
        numPersonas: 2,
        huesped: { nombre: "Ana Pérez", email: "ana@example.com", telefono: null },
        tipoDeHabitacion: { nombre: "Suite" },
        propiedad: { nombre: "Casa Canteras", email: null, colorPrimario: null },
        pagosOnline: [{ montoMxn: 3_000, montoReembolsadoMxn: 0, reembolsoPendienteMxn: 0 }],
        pagosExternos: [],
      });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.executeRaw).toHaveBeenCalledTimes(1);
    expect(mocks.executeRaw.mock.calls[0][0].join("")).toContain("19");
    expect(mocks.executeRaw.mock.calls[0][1]).toBe("res_manual");
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.reservaFindFirst.mock.invocationCallOrder[0]
    );
    expect(mocks.executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.pagoOnlineCreate.mock.invocationCallOrder[0]
    );
    expect(mocks.enviarComprobantePago).toHaveBeenCalledWith(expect.objectContaining({
      codigoReserva: "RES-MANUAL",
      montoRecibidoCentavos: 300_000,
      totalPagadoCentavos: 300_000,
      totalReservaCentavos: 600_000,
      saldoPendienteCentavos: 300_000,
    }));
  });

  it("un abono de grupo asigna el monto actual sin confundirlo con el total", async () => {
    mocks.constructEvent.mockReturnValue(checkoutGroupPaymentEvent());
    mocks.paymentIntentRetrieve.mockResolvedValue({ id: "pi_grupo_pago", transfer_data: null });
    const reservas = [
      { id: "res_1", totalMxn: 3_000, estado: "CONFIRMADA", numPersonas: 1 },
      { id: "res_2", totalMxn: 3_000, estado: "CONFIRMADA", numPersonas: 1 },
    ];
    mocks.grupoFindFirst.mockResolvedValue({
      id: "grupo_1",
      propiedadId: "prop_1",
      totalPagado: 0,
      reservas,
    });
    mocks.grupoUpdate.mockResolvedValue({
      id: "grupo_1",
      propiedadId: "prop_1",
      totalPagado: 3_000,
      reservas,
    });
    mocks.reservaFindMany.mockResolvedValue(reservas);
    mocks.pagoOnlineCreate.mockResolvedValue({ id: "pago_grupo" });
    mocks.grupoFindUnique.mockResolvedValue({
      id: "grupo_1",
      codigoGrupo: "GRP-AAAA-BBBB",
      nombre: "Boda",
      propiedad: { nombre: "Casa Canteras", colorPrimario: null },
      reservas: [{
        ...reservas[0],
        fechaIngreso: new Date("2026-09-10T00:00:00Z"),
        fechaSalida: new Date("2026-09-12T00:00:00Z"),
        huesped: { nombre: "Ana Pérez", email: "ana@example.com" },
        tipoDeHabitacion: { nombre: "Suite" },
      }],
    });

    await POST(request());

    expect(mocks.enviarComprobantePago).toHaveBeenCalledWith(expect.objectContaining({
      codigoReserva: "GRP-AAAA-BBBB",
      montoRecibidoCentavos: 300_000,
      totalPagadoCentavos: 300_000,
      totalReservaCentavos: 600_000,
      saldoPendienteCentavos: 300_000,
    }));
  });
});
