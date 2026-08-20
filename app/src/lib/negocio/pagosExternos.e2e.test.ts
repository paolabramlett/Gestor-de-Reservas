import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient, RolUsuario } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  crearRepositorioPrismaPagosExternos,
  crearServicioPagosExternos,
  ErrorPagoExterno,
} from "./pagosExternos.server";

const databaseUrlE2E = process.env.DATABASE_URL_E2E ?? "";
const aislamientoConfirmado = process.env.PAGOS_EXTERNOS_E2E_ISOLATED === "true";
const describeE2E = databaseUrlE2E && aislamientoConfirmado ? describe : describe.skip;

function validarUrlAislada(url: string) {
  const parsed = new URL(url);
  const nombreBase = parsed.pathname.replace(/^\//, "");
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
    throw new Error("E2E_REQUIERE_POSTGRESQL");
  }
  if (!/(^|[_-])(test|e2e)([_-]|$)/i.test(nombreBase)) {
    throw new Error("E2E_REQUIERE_NOMBRE_BASE_TEST_O_E2E");
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL === url) {
    throw new Error("E2E_NO_PUEDE_USAR_DATABASE_URL_COMPARTIDA");
  }
}

describeE2E("pagos externos concurrentes con PostgreSQL aislado", () => {
  let cliente: PrismaClient;
  let propiedadId = "";
  let reservaId = "";
  let usuarioPropiedadId = "";

  beforeAll(async () => {
    validarUrlAislada(databaseUrlE2E);
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
    if (propiedadId) {
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
});
