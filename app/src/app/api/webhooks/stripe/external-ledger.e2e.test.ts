import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PrismaClient, RolUsuario } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type Stripe from "stripe";

vi.mock("server-only", () => ({}));

const dependencias = vi.hoisted(() => ({
  cliente: null as unknown,
  evento: null as unknown,
  enviarComprobanteWebhook: vi.fn().mockResolvedValue(undefined),
  reembolsarPagoDirecto: vi.fn().mockResolvedValue(undefined),
  reembolsarPagoLegacy: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({}, {
    get(_objetivo, propiedad) {
      const cliente = dependencias.cliente as Record<PropertyKey, unknown>;
      const valor = cliente[propiedad];
      return typeof valor === "function"
        ? valor.bind(dependencias.cliente)
        : valor;
    },
  }),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: vi.fn(() => dependencias.evento) },
    paymentIntents: {
      retrieve: vi.fn(async (id: string) => ({ id, transfer_data: null })),
    },
  },
}));

vi.mock("@/lib/stripeConnect", () => ({
  reembolsarPagoDirectoHuesped: dependencias.reembolsarPagoDirecto,
  reembolsarPagoHuesped: dependencias.reembolsarPagoLegacy,
}));

vi.mock("@/lib/negocio/intentosPago", () => ({
  exigirIntentoPagoAutorizado: vi.fn().mockResolvedValue({ datosReserva: {} }),
  marcarIntentoPagoPagado: vi.fn().mockResolvedValue(undefined),
  obtenerIntentoPago: vi.fn().mockResolvedValue({
    stripeConnectAccountId: "acct_external_ledger_e2e",
  }),
}));

vi.mock("@/lib/emails", () => ({
  enviarConfirmacion: vi.fn().mockResolvedValue(undefined),
  enviarComprobantePago: dependencias.enviarComprobanteWebhook,
  enviarAlertaEquipo: vi.fn().mockResolvedValue(undefined),
  enviarPagoFallido: vi.fn().mockResolvedValue(undefined),
}));

import {
  crearRepositorioPrismaPagosExternos,
  crearServicioPagosExternos,
  ErrorPagoExterno,
} from "@/lib/negocio/pagosExternos.server";
import { reembolsarPagosOnline } from "@/lib/negocio/pagosOnline";
import { POST } from "./route";

type ConfiguracionE2E = {
  databaseUrlE2E: string;
  databaseUrlCompartida: string;
  aislamientoConfirmado: string;
  sentinel: string;
};

function normalizarDestinoPostgres(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") return null;
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const puerto = parsed.port || "5432";
    const base = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!host || !base || base.includes("/")) return null;
    return `postgresql://${host}:${puerto}/${base}`;
  } catch {
    return null;
  }
}

function evaluarConfiguracionE2E(config: ConfiguracionE2E) {
  if (!config.databaseUrlE2E) return { habilitado: false as const, razon: "DATABASE_URL_E2E_AUSENTE" };
  if (config.aislamientoConfirmado !== "true") {
    return { habilitado: false as const, razon: "AISLAMIENTO_NO_CONFIRMADO" };
  }
  const destino = normalizarDestinoPostgres(config.databaseUrlE2E);
  if (!destino) return { habilitado: false as const, razon: "DESTINO_E2E_INVALIDO" };
  if (config.sentinel !== destino) {
    return { habilitado: false as const, razon: "SENTINEL_E2E_NO_COINCIDE" };
  }
  const compartido = config.databaseUrlCompartida
    ? normalizarDestinoPostgres(config.databaseUrlCompartida)
    : null;
  if (compartido === destino) {
    return { habilitado: false as const, razon: "E2E_NO_PUEDE_USAR_DESTINO_COMPARTIDO" };
  }
  return { habilitado: true as const, destino };
}

function leerConfiguracionE2E(): ConfiguracionE2E {
  return {
    databaseUrlE2E: process.env.DATABASE_URL_E2E ?? "",
    databaseUrlCompartida: process.env.DATABASE_URL ?? "",
    aislamientoConfirmado: process.env.PAGOS_EXTERNOS_E2E_ISOLATED ?? "",
    sentinel: process.env.PAGOS_EXTERNOS_E2E_SENTINEL ?? "",
  };
}

const configuracionInicial = leerConfiguracionE2E();
const gateInicial = evaluarConfiguracionE2E(configuracionInicial);
const describeE2E = gateInicial.habilitado ? describe : describe.skip;

describeE2E("aceptación del ledger externo con PostgreSQL aislado", () => {
  let cliente: PrismaClient;
  let propiedadId = "";
  let tipoDeHabitacionId = "";
  let huespedId = "";
  let adminId = "";
  let finanzasId = "";
  let destinoAutorizado = "";
  const cuentaConnect = "acct_external_ledger_e2e";
  const entornoOriginal = {
    secret: process.env.STRIPE_SECRET_KEY,
    webhook: process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
  };

  beforeAll(async () => {
    const gate = evaluarConfiguracionE2E(leerConfiguracionE2E());
    if (!gate.habilitado) throw new Error(gate.razon);
    if (!gateInicial.habilitado || gate.destino !== gateInicial.destino) {
      throw new Error("DESTINO_E2E_CAMBIO_DURANTE_EJECUCION");
    }
    destinoAutorizado = gate.destino;
    cliente = new PrismaClient({
      adapter: new PrismaPg({ connectionString: configuracionInicial.databaseUrlE2E }),
    });
    dependencias.cliente = cliente;
    process.env.STRIPE_SECRET_KEY = "sk_test_external_ledger_e2e";
    process.env.STRIPE_WEBHOOK_SECRET_CONNECT = "whsec_external_ledger_e2e";

    const sufijo = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    propiedadId = `prop_ledger_acceptance_${sufijo}`;
    tipoDeHabitacionId = `tipo_ledger_acceptance_${sufijo}`;
    huespedId = `hue_ledger_acceptance_${sufijo}`;
    adminId = `usr_admin_ledger_acceptance_${sufijo}`;
    finanzasId = `usr_fin_ledger_acceptance_${sufijo}`;

    await cliente.propiedad.create({
      data: {
        id: propiedadId,
        clerkOrgId: `org_${sufijo}`,
        slug: `ledger-acceptance-${sufijo}`,
        nombre: "Hotel E2E Ledger",
        stripeConnectAccountId: cuentaConnect,
        stripeConnectHabilitado: true,
      },
    });
    await cliente.usuarioPropiedad.createMany({
      data: [
        {
          id: adminId,
          clerkUserId: `clerk_admin_${sufijo}`,
          propiedadId,
          rol: RolUsuario.ADMIN,
        },
        {
          id: finanzasId,
          clerkUserId: `clerk_fin_${sufijo}`,
          propiedadId,
          rol: RolUsuario.FINANZAS,
        },
      ],
    });
    await cliente.tipoDeHabitacion.create({
      data: {
        id: tipoDeHabitacionId,
        propiedadId,
        nombre: "Suite E2E Ledger",
        capacidadMin: 1,
        capacidadMax: 2,
        fotos: [],
        amenidades: [],
        tarifaBasePrice: 6_000,
        tarifaBaseModalidad: "POR_HABITACION",
      },
    });
    await cliente.huesped.create({
      data: {
        id: huespedId,
        propiedadId,
        nombre: "Huésped E2E Ledger",
        email: `ledger-${sufijo}@example.test`,
      },
    });
  });

  afterAll(async () => {
    if (entornoOriginal.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = entornoOriginal.secret;
    if (entornoOriginal.webhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET_CONNECT;
    else process.env.STRIPE_WEBHOOK_SECRET_CONNECT = entornoOriginal.webhook;
    if (!cliente) return;
    const gate = evaluarConfiguracionE2E(leerConfiguracionE2E());
    const puedeBorrar = gate.habilitado && gate.destino === destinoAutorizado;
    if (propiedadId && puedeBorrar) {
      const pagos = await cliente.pagoExterno.findMany({
        where: { propiedadId },
        select: { id: true },
      });
      await cliente.ajustePagoExterno.deleteMany({
        where: { pagoExternoId: { in: pagos.map((pago) => pago.id) } },
      });
      await cliente.pagoExterno.deleteMany({ where: { propiedadId } });
      await cliente.pagoOnline.deleteMany({ where: { propiedadId } });
      await cliente.reserva.deleteMany({ where: { propiedadId } });
      await cliente.huesped.deleteMany({ where: { propiedadId } });
      await cliente.tipoDeHabitacion.deleteMany({ where: { propiedadId } });
      await cliente.usuarioPropiedad.deleteMany({ where: { propiedadId } });
      await cliente.propiedad.delete({ where: { id: propiedadId } });
    }
    await cliente.$disconnect();
    dependencias.cliente = null;
  });

  async function crearReserva(etiqueta: string) {
    const sufijo = `${etiqueta}_${crypto.randomUUID().slice(0, 8)}`;
    return cliente.reserva.create({
      data: {
        id: `res_${sufijo}`,
        codigoReserva: `E2E-${sufijo}`,
        propiedadId,
        tipoDeHabitacionId,
        huespedId,
        origen: "MANUAL",
        estado: "PENDIENTE_PAGO",
        fechaIngreso: new Date("2032-06-10T00:00:00Z"),
        fechaSalida: new Date("2032-06-11T00:00:00Z"),
        numPersonas: 1,
        nombreHuesped: "Huésped E2E Ledger",
        totalMxn: 6_000,
        desglosePorNoche: [],
      },
    });
  }

  function eventoPagoManual(
    reservaId: string,
    montoCentavos: number,
    sufijo: string
  ): Stripe.Event {
    return {
      id: `evt_${sufijo}`,
      object: "event",
      account: cuentaConnect,
      api_version: "2026-06-24.dahlia",
      created: Math.floor(Date.now() / 1_000),
      data: {
        object: {
          id: `cs_${sufijo}`,
          object: "checkout.session",
          amount_total: montoCentavos,
          currency: "mxn",
          payment_intent: `pi_${sufijo}`,
          payment_status: "paid",
          metadata: {
            tipo: "MANUAL_PAGO",
            propiedadId,
            reservaId,
            roomlyIntentoId: `intento_${sufijo}`,
            montoEsperadoCentavos: String(montoCentavos),
          },
        } as unknown as Stripe.Checkout.Session,
      },
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      type: "checkout.session.completed",
    } as Stripe.Event;
  }

  async function enviarPagoManual(
    reservaId: string,
    montoCentavos: number,
    sufijo: string
  ) {
    dependencias.evento = eventoPagoManual(reservaId, montoCentavos, sufijo);
    return POST(new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "firma-e2e" },
    }));
  }

  it("acepta el flujo mixto, idempotencia, carrera, corrección y reembolsos", async () => {
    const reserva = await crearReserva("flujo");
    const service = crearServicioPagosExternos(
      crearRepositorioPrismaPagosExternos(cliente),
      { ledgerHabilitado: () => true }
    );
    const actor = { usuarioPropiedadId: adminId, propiedadId, rol: RolUsuario.ADMIN };
    dependencias.enviarComprobanteWebhook.mockClear();

    const stripeParcial = await enviarPagoManual(reserva.id, 300_000, `parcial_${reserva.id}`);

    expect(stripeParcial.status).toBe(200);
    await vi.waitFor(() => {
      expect(dependencias.enviarComprobanteWebhook).toHaveBeenCalledWith(
        expect.objectContaining({
          codigoReserva: reserva.codigoReserva,
          montoRecibidoCentavos: 300_000,
          totalPagadoCentavos: 300_000,
          totalReservaCentavos: 600_000,
          saldoPendienteCentavos: 300_000,
        })
      );
    });
    expect((await service.obtenerLedgerReserva(actor, reserva.id)).resumen).toMatchObject({
      estado: "PAGO_PARCIAL",
      stripeNetoCentavos: 300_000,
      saldoPendienteCentavos: 300_000,
    });

    const claveTransferencia = `transferencia_${reserva.id}`;
    const transferencia = await service.registrarPagoExterno(actor, {
      reservaId: reserva.id,
      montoCentavos: 200_000,
      metodo: "TRANSFERENCIA",
      fechaPago: new Date("2032-06-09T18:00:00Z"),
      enviarComprobante: false,
      idempotencyKey: claveTransferencia,
    });
    expect((await service.obtenerLedgerReserva(actor, reserva.id)).resumen).toMatchObject({
      pagadoNetoCentavos: 500_000,
      saldoPendienteCentavos: 100_000,
    });

    await service.registrarPagoExterno(actor, {
      reservaId: reserva.id,
      montoCentavos: 200_000,
      metodo: "TRANSFERENCIA",
      fechaPago: new Date("2032-06-09T18:00:00Z"),
      enviarComprobante: false,
      idempotencyKey: claveTransferencia,
    });
    expect(await cliente.pagoExterno.count({
      where: { reservaId: reserva.id, idempotencyKey: claveTransferencia },
    })).toBe(1);

    const claveFinalExterna = `final_externo_${reserva.id}`;
    const carrera = await Promise.allSettled([
      enviarPagoManual(reserva.id, 100_000, `final_stripe_${reserva.id}`),
      service.registrarPagoExterno(actor, {
        reservaId: reserva.id,
        montoCentavos: 100_000,
        metodo: "EFECTIVO",
        fechaPago: new Date("2032-06-09T19:00:00Z"),
        enviarComprobante: false,
        idempotencyKey: claveFinalExterna,
      }),
    ]);
    const resultadoStripe = carrera[0];
    const resultadoExterno = carrera[1];
    expect(resultadoStripe.status).toBe("fulfilled");
    if (resultadoStripe.status !== "fulfilled") throw resultadoStripe.reason;
    const pagoStripeFinalId = `pi_final_stripe_${reserva.id}`;
    if (resultadoExterno.status === "rejected") {
      expect(resultadoExterno.reason).toBeInstanceOf(ErrorPagoExterno);
      expect(resultadoExterno.reason).toMatchObject({ codigo: "SALDO_INSUFICIENTE" });
      expect(await resultadoStripe.value.json()).toEqual({ received: true });
      const pagoStripeFinal = await cliente.pagoOnline.findUniqueOrThrow({
        where: { stripePaymentIntentId: pagoStripeFinalId },
      });
      expect(pagoStripeFinal.estado).toBe("PAGADO");
      expect(Number(pagoStripeFinal.montoReembolsadoMxn)).toBe(0);
    } else {
      expect(await resultadoStripe.value.json()).toMatchObject({ reembolsado: true });
      const pagoStripeFinal = await cliente.pagoOnline.findUniqueOrThrow({
        where: { stripePaymentIntentId: pagoStripeFinalId },
      });
      expect(pagoStripeFinal.estado).toBe("REEMBOLSADO");
      expect(Number(pagoStripeFinal.montoReembolsadoMxn)).toBe(1_000);
    }
    expect(await cliente.pagoExterno.count({
      where: { reservaId: reserva.id, idempotencyKey: claveFinalExterna },
    })).toBe(resultadoExterno.status === "fulfilled" ? 1 : 0);
    const ledgerFinal = await service.obtenerLedgerReserva(actor, reserva.id);
    expect(ledgerFinal.resumen).toMatchObject({
      pagadoNetoCentavos: 600_000,
      saldoPendienteCentavos: 0,
    });
    expect(ledgerFinal.resumen.stripeNetoCentavos + ledgerFinal.resumen.externoNetoCentavos)
      .toBeLessThanOrEqual(ledgerFinal.reserva.totalReservaCentavos);

    const correccion = await service.corregirPagoExterno(actor, {
      reservaId: reserva.id,
      pagoExternoId: transferencia.id,
      nuevoMontoCentavos: 150_000,
      metodo: "TRANSFERENCIA",
      fechaPago: new Date("2032-06-09T18:00:00Z"),
      motivo: "Monto capturado incorrectamente",
      idempotencyKey: `correccion_${reserva.id}`,
    });
    const ledgerCorregido = await service.obtenerLedgerReserva(actor, reserva.id);
    expect(ledgerCorregido.pagosExternos.find((pago) => pago.id === transferencia.id)?.ajustes)
      .toEqual([expect.objectContaining({ tipo: "ANULACION", montoCentavos: 200_000 })]);
    expect(ledgerCorregido.pagosExternos).toContainEqual(expect.objectContaining({
      id: correccion.reemplazo.id,
      reemplazaPagoExternoId: transferencia.id,
      montoCentavos: 150_000,
    }));
    expect(ledgerCorregido.resumen.saldoPendienteCentavos).toBe(50_000);

    await service.ajustarPagoExterno(actor, {
      reservaId: reserva.id,
      pagoExternoId: correccion.reemplazo.id,
      tipo: "REEMBOLSO",
      montoCentavos: 50_000,
      motivo: "Reembolso externo parcial",
      idempotencyKey: `reembolso_externo_${reserva.id}`,
    });
    expect((await service.obtenerLedgerReserva(actor, reserva.id)).resumen.saldoPendienteCentavos)
      .toBe(100_000);

    await reembolsarPagosOnline({ reservaId: reserva.id, montoMxn: 1_000 });
    expect((await service.obtenerLedgerReserva(actor, reserva.id)).resumen).toMatchObject({
      pagadoNetoCentavos: 400_000,
      saldoPendienteCentavos: 200_000,
    });
  }, 30_000);

  it("deniega a FINANZAS una mutación sin escribir filas", async () => {
    const reserva = await crearReserva("finanzas");
    const service = crearServicioPagosExternos(
      crearRepositorioPrismaPagosExternos(cliente),
      { ledgerHabilitado: () => true }
    );
    const antes = await Promise.all([
      cliente.pagoExterno.count({ where: { reservaId: reserva.id } }),
      cliente.ajustePagoExterno.count({
        where: { pagoExterno: { reservaId: reserva.id } },
      }),
    ]);

    await expect(service.registrarPagoExterno({
      usuarioPropiedadId: finanzasId,
      propiedadId,
      rol: RolUsuario.FINANZAS,
    }, {
      reservaId: reserva.id,
      montoCentavos: 100_000,
      metodo: "TRANSFERENCIA",
      fechaPago: new Date("2032-06-09T18:00:00Z"),
      enviarComprobante: false,
      idempotencyKey: `finanzas_denegado_${reserva.id}`,
    })).rejects.toMatchObject({ codigo: "ROL_PAGO_EXTERNO_DENEGADO" });

    expect(await Promise.all([
      cliente.pagoExterno.count({ where: { reservaId: reserva.id } }),
      cliente.ajustePagoExterno.count({
        where: { pagoExterno: { reservaId: reserva.id } },
      }),
    ])).toEqual(antes);
  });

  it("persiste el pago si falla el comprobante y el reenvío cambia sólo su estado", async () => {
    const reserva = await crearReserva("comprobante");
    const enviarComprobante = vi.fn()
      .mockRejectedValueOnce(new Error("Proveedor no disponible"))
      .mockResolvedValueOnce(undefined);
    const service = crearServicioPagosExternos(
      crearRepositorioPrismaPagosExternos(cliente),
      { ledgerHabilitado: () => true, enviarComprobante }
    );
    const actor = { usuarioPropiedadId: adminId, propiedadId, rol: RolUsuario.ADMIN };

    const fallido = await service.registrarPagoExterno(actor, {
      reservaId: reserva.id,
      montoCentavos: 125_000,
      metodo: "TRANSFERENCIA",
      fechaPago: new Date("2032-06-09T18:00:00Z"),
      nota: "Referencia E2E",
      enviarComprobante: true,
      idempotencyKey: `comprobante_${reserva.id}`,
    });
    expect(fallido).toMatchObject({
      estadoComprobante: "FALLIDO",
      comprobanteEnviadoEn: null,
    });
    expect(await cliente.pagoExterno.count({ where: { id: fallido.id } })).toBe(1);
    const financieroAntes = await cliente.pagoExterno.findUniqueOrThrow({
      where: { id: fallido.id },
      select: {
        propiedadId: true,
        reservaId: true,
        montoMxn: true,
        metodo: true,
        fechaPago: true,
        nota: true,
        creadoPorUsuarioId: true,
        idempotencyKey: true,
        reemplazaPagoExternoId: true,
      },
    });

    const reenviado = await service.reenviarComprobantePagoExterno(actor, {
      reservaId: reserva.id,
      pagoExternoId: fallido.id,
    });
    expect(reenviado).toMatchObject({
      estadoComprobante: "ENVIADO",
      comprobanteEnviadoEn: expect.any(Date),
      comprobanteError: null,
    });
    expect(await cliente.pagoExterno.findUniqueOrThrow({
      where: { id: fallido.id },
      select: {
        propiedadId: true,
        reservaId: true,
        montoMxn: true,
        metodo: true,
        fechaPago: true,
        nota: true,
        creadoPorUsuarioId: true,
        idempotencyKey: true,
        reemplazaPagoExternoId: true,
      },
    })).toEqual(financieroAntes);
    expect(await cliente.pagoExterno.count({ where: { reservaId: reserva.id } })).toBe(1);
  });
});
