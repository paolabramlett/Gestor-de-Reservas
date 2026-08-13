import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/emails", () => ({
  enviarConfirmacion: vi.fn().mockResolvedValue(undefined),
  enviarAlertaEquipo: vi.fn().mockResolvedValue(undefined),
  enviarPagoFallido: vi.fn().mockResolvedValue(undefined),
}));

const describeE2E = process.env.RUN_STRIPE_E2E === "1" ? describe : describe.skip;
const databaseUrl = process.env.DATABASE_URL ?? "";
const stripeKey = process.env.STRIPE_SECRET_KEY ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_CONNECT ?? "";

describeE2E("webhook Stripe con PostgreSQL aislado y Stripe Test", () => {
  let prisma: PrismaClient;
  let stripe: Stripe;
  let cuentaConnect = "";
  let propiedadId = "";
  let secuencia = 0;

  beforeAll(async () => {
    if (!stripeKey.startsWith("sk_test_")) throw new Error("E2E_REQUIERE_STRIPE_TEST");
    if (!databaseUrl.includes("127.0.0.1:55432")) throw new Error("E2E_REQUIERE_POSTGRES_LOCAL");
    if (!webhookSecret.startsWith("whsec_")) throw new Error("E2E_REQUIERE_WEBHOOK_SECRET");
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
    stripe = new Stripe(stripeKey, { apiVersion: "2026-06-24.dahlia" });
    const cuentas = await stripe.accounts.list({ limit: 100 });
    const cuenta = cuentas.data.find((item) => item.capabilities?.card_payments === "active");
    if (!cuenta) throw new Error("E2E_REQUIERE_CUENTA_CONNECT_TEST_ACTIVA");
    cuentaConnect = cuenta.id;
    await prisma.propiedad.updateMany({
      where: {
        stripeConnectAccountId: cuentaConnect,
        nombre: "E2E Hotel",
      },
      data: {
        stripeConnectAccountId: null,
        stripeConnectHabilitado: false,
      },
    });
    propiedadId = `prop_e2e_${Date.now()}`;
    await prisma.propiedad.create({
      data: {
        id: propiedadId,
        clerkOrgId: `org_${propiedadId}`,
        slug: `e2e-${Date.now()}`,
        nombre: "E2E Hotel",
        planActivo: "PRO",
        suscripcionActiva: true,
        accesoGratisLegacy: false,
        stripeConnectAccountId: cuentaConnect,
        stripeConnectHabilitado: true,
      },
    });
  }, 30_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  async function crearTipoConInventario(precioMxn: number) {
    secuencia++;
    const tipo = await prisma.tipoDeHabitacion.create({
      data: {
        propiedadId,
        nombre: `Tipo E2E ${secuencia}`,
        capacidadMin: 1,
        capacidadMax: 2,
        fotos: [],
        amenidades: [],
        tarifaBasePrice: precioMxn,
        tarifaBaseModalidad: "POR_HABITACION",
      },
    });
    await prisma.habitacion.create({
      data: { propiedadId, tipoDeHabitacionId: tipo.id, numero: `E2E-${secuencia}` },
    });
    return tipo;
  }

  async function crearIntent(tipoDeHabitacionId: string, montoCentavos: number, fechaIngreso: string, fechaSalida: string) {
    const intentoId = crypto.randomUUID();
    await prisma.intentoDePagoStripe.create({
      data: {
        intentoId,
        propiedadId,
        stripeConnectAccountId: cuentaConnect,
        tipo: "RESERVA_INDIVIDUAL",
        montoCentavos,
        moneda: "mxn",
        datosReserva: {
          tipoDeHabitacionId,
          nombre: "Huésped E2E",
          email: "e2e@example.com",
          telefono: "",
          fechaIngreso,
          fechaSalida,
          numPersonas: 2,
        },
      },
    });
    const intent = await stripe.paymentIntents.create({
      amount: montoCentavos,
      currency: "mxn",
      payment_method: "pm_card_visa",
      confirm: true,
      automatic_payment_methods: { enabled: true, allow_redirects: "never" },
      metadata: {
        propiedadId,
        tipoDeHabitacionId,
        nombre: "Huésped E2E",
        email: "e2e@example.com",
        telefono: "",
        fechaIngreso,
        fechaSalida,
        numPersonas: "2",
        montoEsperadoCentavos: String(montoCentavos),
        roomlyIntentoId: intentoId,
      },
    }, { stripeAccount: cuentaConnect });
    await prisma.intentoDePagoStripe.update({
      where: { intentoId },
      data: { stripePaymentIntentId: intent.id },
    });
    return intent;
  }

  async function enviarWebhook(intent: Stripe.PaymentIntent, eventId: string) {
    const payload = JSON.stringify({
      id: eventId,
      object: "event",
      account: cuentaConnect,
      api_version: "2026-06-24.dahlia",
      created: Math.floor(Date.now() / 1000),
      data: { object: intent },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "payment_intent.succeeded",
    });
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    const { POST } = await import("./route");
    return POST(new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: payload,
      headers: { "stripe-signature": signature, "content-type": "application/json" },
    }));
  }

  it("crea una sola Reserva y un solo PagoOnline al repetir el mismo webhook", async () => {
    const tipo = await crearTipoConInventario(150);
    const intent = await crearIntent(tipo.id, 15_000, "2031-01-10", "2031-01-11");
    const evento = `evt_e2e_idempotente_${Date.now()}`;

    const primera = await enviarWebhook(intent, evento);
    const segunda = await enviarWebhook(intent, evento);

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(await prisma.reserva.count({ where: { stripePaymentIntentId: intent.id } })).toBe(1);
    expect(await prisma.pagoOnline.count({ where: { stripePaymentIntentId: intent.id } })).toBe(1);
  }, 45_000);

  it("confirma una sola Reserva y reembolsa el segundo pago por la última Habitación", async () => {
    const tipo = await crearTipoConInventario(175);
    const [intentA, intentB] = await Promise.all([
      crearIntent(tipo.id, 17_500, "2031-02-10", "2031-02-11"),
      crearIntent(tipo.id, 17_500, "2031-02-10", "2031-02-11"),
    ]);

    const [respuestaA, respuestaB] = await Promise.all([
      enviarWebhook(intentA, `evt_e2e_inventory_a_${Date.now()}`),
      enviarWebhook(intentB, `evt_e2e_inventory_b_${Date.now()}`),
    ]);
    expect(respuestaA.status).toBe(200);
    expect(respuestaB.status).toBe(200);
    expect(await prisma.reserva.count({ where: { tipoDeHabitacionId: tipo.id } })).toBe(1);

    const intents = await Promise.all([
      stripe.paymentIntents.retrieve(intentA.id, { expand: ["latest_charge"] }, { stripeAccount: cuentaConnect }),
      stripe.paymentIntents.retrieve(intentB.id, { expand: ["latest_charge"] }, { stripeAccount: cuentaConnect }),
    ]);
    const reembolsados = intents.filter((intent) =>
      intent.latest_charge && typeof intent.latest_charge !== "string" && intent.latest_charge.amount_refunded === intent.amount_received
    );
    expect(reembolsados).toHaveLength(1);
  }, 60_000);

  it("no mueve un centavo al balance de Roomly ni crea application fee", async () => {
    const saldoMxnPlataforma = async () => {
      const balance = await stripe.balance.retrieve();
      return [...balance.available, ...balance.pending]
        .filter((saldo) => saldo.currency === "mxn")
        .reduce((total, saldo) => total + saldo.amount, 0);
    };

    const saldoAntes = await saldoMxnPlataforma();
    const tipo = await crearTipoConInventario(199);
    const intent = await crearIntent(tipo.id, 19_900, "2031-03-10", "2031-03-11");
    const saldoDespues = await saldoMxnPlataforma();

    expect(intent.application_fee_amount).toBeNull();
    expect(saldoDespues).toBe(saldoAntes);
  }, 45_000);

  it("Stripe confirma que el hotel paga comisiones y Stripe asume sus pérdidas", async () => {
    const cuenta = await stripe.accounts.retrieve(cuentaConnect);

    expect(cuenta.controller?.fees?.payer).toBe("account");
    expect(cuenta.controller?.losses?.payments).toBe("stripe");
    expect(cuenta.controller?.requirement_collection).toBe("stripe");
    expect(cuenta.controller?.stripe_dashboard?.type).toBe("full");
    expect(cuenta.charges_enabled).toBe(true);
    expect(cuenta.capabilities?.card_payments).toBe("active");
  }, 30_000);
});
