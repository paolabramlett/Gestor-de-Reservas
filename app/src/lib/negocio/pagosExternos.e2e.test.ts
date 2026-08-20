import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, RolUsuario } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  crearRepositorioPrismaPagosExternos,
  crearServicioPagosExternos,
  ErrorPagoExterno,
} from "./pagosExternos.server";

type ConfiguracionE2E = {
  databaseUrlE2E: string;
  databaseUrlCompartida: string;
  aislamientoConfirmado: string;
  sentinel: string;
};

type ResultadoGateE2E =
  | { habilitado: true; destino: string }
  | { habilitado: false; razon: string };

function normalizarDestinoPostgres(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
      return null;
    }
    const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
    const puerto = parsed.port || "5432";
    const base = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!host || !base || base.includes("/")) return null;
    return `postgresql://${host}:${puerto}/${base}`;
  } catch {
    return null;
  }
}

function evaluarConfiguracionE2E(config: ConfiguracionE2E): ResultadoGateE2E {
  if (!config.databaseUrlE2E) {
    return { habilitado: false, razon: "DATABASE_URL_E2E_AUSENTE" };
  }
  if (config.aislamientoConfirmado !== "true") {
    return { habilitado: false, razon: "AISLAMIENTO_NO_CONFIRMADO" };
  }
  const destinoE2E = normalizarDestinoPostgres(config.databaseUrlE2E);
  if (!destinoE2E) {
    return { habilitado: false, razon: "DESTINO_E2E_INVALIDO" };
  }
  if (config.sentinel !== destinoE2E) {
    return { habilitado: false, razon: "SENTINEL_E2E_NO_COINCIDE" };
  }
  const destinoCompartido = config.databaseUrlCompartida
    ? normalizarDestinoPostgres(config.databaseUrlCompartida)
    : null;
  if (destinoCompartido === destinoE2E) {
    return { habilitado: false, razon: "E2E_NO_PUEDE_USAR_DESTINO_COMPARTIDO" };
  }
  return { habilitado: true, destino: destinoE2E };
}

describe("gate de PostgreSQL E2E aislado", () => {
  it("rechaza como compartidos destinos equivalentes tras normalizarlos", () => {
    expect(evaluarConfiguracionE2E({
      databaseUrlE2E:
        "postgres://e2e:secret@DB.EXAMPLE/roomly_e2e?application_name=pagos",
      databaseUrlCompartida:
        "postgresql://app:secret@db.example:5432/roomly_e2e?schema=public",
      aislamientoConfirmado: "true",
      sentinel: "postgresql://db.example:5432/roomly_e2e",
    })).toEqual({
      habilitado: false,
      razon: "E2E_NO_PUEDE_USAR_DESTINO_COMPARTIDO",
    });
  });

  it("mantiene skip seguro sin sentinel exacto de instancia", () => {
    expect(evaluarConfiguracionE2E({
      databaseUrlE2E: "postgresql://e2e:secret@127.0.0.1:55432/roomly_e2e",
      databaseUrlCompartida: "",
      aislamientoConfirmado: "true",
      sentinel: "",
    })).toEqual({
      habilitado: false,
      razon: "SENTINEL_E2E_NO_COINCIDE",
    });
  });

  it("habilita únicamente el destino normalizado confirmado por el sentinel", () => {
    expect(evaluarConfiguracionE2E({
      databaseUrlE2E:
        "postgres://e2e:secret@LOCALHOST:55432/roomly_e2e?application_name=pagos",
      databaseUrlCompartida: "postgresql://app:secret@localhost:5432/roomly",
      aislamientoConfirmado: "true",
      sentinel: "postgresql://localhost:55432/roomly_e2e",
    })).toEqual({
      habilitado: true,
      destino: "postgresql://localhost:55432/roomly_e2e",
    });
  });
});

function leerConfiguracionE2E(): ConfiguracionE2E {
  return {
    databaseUrlE2E: process.env.DATABASE_URL_E2E ?? "",
    databaseUrlCompartida: process.env.DATABASE_URL ?? "",
    aislamientoConfirmado: process.env.PAGOS_EXTERNOS_E2E_ISOLATED ?? "",
    sentinel: process.env.PAGOS_EXTERNOS_E2E_SENTINEL ?? "",
  };
}

const configuracionInicial = leerConfiguracionE2E();
const databaseUrlE2E = configuracionInicial.databaseUrlE2E;
const gateInicial = evaluarConfiguracionE2E(configuracionInicial);
const describeE2E = gateInicial.habilitado ? describe : describe.skip;

describeE2E("pagos externos concurrentes con PostgreSQL aislado", () => {
  let cliente: PrismaClient;
  let propiedadId = "";
  let reservaId = "";
  let usuarioPropiedadId = "";
  let destinoAutorizado = "";

  beforeAll(async () => {
    const gate = evaluarConfiguracionE2E(leerConfiguracionE2E());
    if (!gate.habilitado) throw new Error(gate.razon);
    if (!gateInicial.habilitado || gate.destino !== gateInicial.destino) {
      throw new Error("DESTINO_E2E_CAMBIO_DURANTE_EJECUCION");
    }
    destinoAutorizado = gateInicial.destino;
    cliente = new PrismaClient({
      adapter: new PrismaPg({ connectionString: databaseUrlE2E }),
    });

    const sufijo = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
    propiedadId = `prop_pago_ext_e2e_${sufijo}`;
    reservaId = `res_pago_ext_e2e_${sufijo}`;
    usuarioPropiedadId = `usr_pago_ext_e2e_${sufijo}`;
    const tipoDeHabitacionId = `tipo_pago_ext_e2e_${sufijo}`;
    const huespedId = `hue_pago_ext_e2e_${sufijo}`;

    await cliente.propiedad.create({
      data: {
        id: propiedadId,
        clerkOrgId: `org_${sufijo}`,
        slug: `pagos-ext-e2e-${sufijo}`,
        nombre: "Propiedad E2E Pagos Externos",
      },
    });
    await cliente.usuarioPropiedad.create({
      data: {
        id: usuarioPropiedadId,
        clerkUserId: `clerk_${sufijo}`,
        propiedadId,
        rol: RolUsuario.ADMIN,
      },
    });
    await cliente.tipoDeHabitacion.create({
      data: {
        id: tipoDeHabitacionId,
        propiedadId,
        nombre: "Tipo E2E",
        capacidadMin: 1,
        capacidadMax: 2,
        fotos: [],
        amenidades: [],
        tarifaBasePrice: 1_000,
        tarifaBaseModalidad: "POR_HABITACION",
      },
    });
    await cliente.huesped.create({
      data: {
        id: huespedId,
        propiedadId,
        nombre: "Huésped E2E",
        email: `pagos-ext-${sufijo}@example.test`,
      },
    });
    await cliente.reserva.create({
      data: {
        id: reservaId,
        codigoReserva: `E2E-${sufijo}`,
        propiedadId,
        tipoDeHabitacionId,
        huespedId,
        origen: "MANUAL",
        estado: "CONFIRMADA",
        fechaIngreso: new Date("2032-01-10T00:00:00Z"),
        fechaSalida: new Date("2032-01-11T00:00:00Z"),
        numPersonas: 1,
        nombreHuesped: "Huésped E2E",
        totalMxn: 1_000,
        desglosePorNoche: [],
      },
    });
  });

  afterAll(async () => {
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
      await cliente.reserva.deleteMany({ where: { propiedadId } });
      await cliente.huesped.deleteMany({ where: { propiedadId } });
      await cliente.habitacion.deleteMany({ where: { propiedadId } });
      await cliente.tipoDeHabitacion.deleteMany({ where: { propiedadId } });
      await cliente.usuarioPropiedad.deleteMany({ where: { propiedadId } });
      await cliente.propiedad.deleteMany({ where: { id: propiedadId } });
    }
    await cliente.$disconnect();
  });

  it("serializa dos cobros cuyo total combinado excedería el saldo", async () => {
    const service = crearServicioPagosExternos(
      crearRepositorioPrismaPagosExternos(cliente),
      { ledgerHabilitado: () => true }
    );
    const actor = {
      usuarioPropiedadId,
      propiedadId,
      rol: RolUsuario.ADMIN,
    };
    const base = {
      reservaId,
      montoCentavos: 60_000,
      metodo: "TRANSFERENCIA" as const,
      fechaPago: new Date("2032-01-09T18:00:00Z"),
      enviarComprobante: false,
    };

    const resultados = await Promise.allSettled([
      service.registrarPagoExterno(actor, { ...base, idempotencyKey: `a_${reservaId}` }),
      service.registrarPagoExterno(actor, { ...base, idempotencyKey: `b_${reservaId}` }),
    ]);

    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const rechazado = resultados.find((resultado) => resultado.status === "rejected");
    expect(rechazado).toMatchObject({
      status: "rejected",
      reason: expect.any(ErrorPagoExterno),
    });
    if (rechazado?.status === "rejected") {
      expect(rechazado.reason).toMatchObject({ codigo: "SALDO_INSUFICIENTE" });
    }

    const ledger = await service.obtenerLedgerReserva(actor, reservaId);
    expect(ledger.pagosExternos).toHaveLength(1);
    expect(ledger.resumen.externoNetoCentavos).toBe(60_000);
    expect(ledger.resumen.externoNetoCentavos).toBeLessThanOrEqual(
      ledger.reserva.totalReservaCentavos
    );
  });

  it("serializa una carrera entre registro y ajuste con la misma clave global", async () => {
    const service = crearServicioPagosExternos(
      crearRepositorioPrismaPagosExternos(cliente),
      { ledgerHabilitado: () => true }
    );
    const actor = { usuarioPropiedadId, propiedadId, rol: RolUsuario.ADMIN };
    const plantilla = await cliente.reserva.findUniqueOrThrow({
      where: { id: reservaId },
      select: { tipoDeHabitacionId: true, huespedId: true },
    });
    const sufijo = crypto.randomUUID().slice(0, 8);
    const reservaOrigenId = `res_idem_origen_${sufijo}`;
    const reservaDestinoId = `res_idem_destino_${sufijo}`;
    const datosReserva = {
      propiedadId,
      tipoDeHabitacionId: plantilla.tipoDeHabitacionId,
      huespedId: plantilla.huespedId,
      origen: "MANUAL" as const,
      estado: "CONFIRMADA" as const,
      fechaIngreso: new Date("2032-02-10T00:00:00Z"),
      fechaSalida: new Date("2032-02-11T00:00:00Z"),
      numPersonas: 1,
      nombreHuesped: "Huésped E2E",
      totalMxn: 1_000,
      desglosePorNoche: [],
    };
    await cliente.reserva.createMany({
      data: [
        { ...datosReserva, id: reservaOrigenId, codigoReserva: `E2E-O-${sufijo}` },
        { ...datosReserva, id: reservaDestinoId, codigoReserva: `E2E-D-${sufijo}` },
      ],
    });
    const pagoOrigen = await service.registrarPagoExterno(actor, {
      reservaId: reservaOrigenId,
      montoCentavos: 20_000,
      metodo: "TRANSFERENCIA",
      fechaPago: new Date("2032-02-09T18:00:00Z"),
      enviarComprobante: false,
      idempotencyKey: `seed_${sufijo}`,
    });
    const claveCompartida = `race_cross_${sufijo}`;

    const resultados = await Promise.allSettled([
      service.ajustarPagoExterno(actor, {
        reservaId: reservaOrigenId,
        pagoExternoId: pagoOrigen.id,
        tipo: "REEMBOLSO",
        montoCentavos: 5_000,
        motivo: "Carrera E2E",
        idempotencyKey: claveCompartida,
      }),
      service.registrarPagoExterno(actor, {
        reservaId: reservaDestinoId,
        montoCentavos: 5_000,
        metodo: "EFECTIVO",
        fechaPago: new Date("2032-02-09T18:01:00Z"),
        enviarComprobante: false,
        idempotencyKey: claveCompartida,
      }),
    ]);

    expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
    const rechazado = resultados.find((resultado) => resultado.status === "rejected");
    if (rechazado?.status !== "rejected") throw new Error("E2E_RECHAZO_AUSENTE");
    expect(rechazado.reason).toMatchObject({ codigo: "IDEMPOTENCIA_CONFLICTO" });
    const [pagosConClave, ajustesConClave] = await Promise.all([
      cliente.pagoExterno.count({ where: { idempotencyKey: claveCompartida } }),
      cliente.ajustePagoExterno.count({ where: { idempotencyKey: claveCompartida } }),
    ]);
    expect(pagosConClave + ajustesConClave).toBe(1);
  });
});
