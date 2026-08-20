import { describe, expect, it } from "vitest";
import { RolUsuario } from "@prisma/client";
import { renderizarComprobantePago } from "./emails";
import {
  crearServicioPagosExternos,
  type PagoExternoLedger,
} from "./negocio/pagosExternos.server";

const comprobanteBase = {
  montoRecibidoCentavos: 300_000,
  totalPagadoCentavos: 300_000,
  totalReservaCentavos: 600_000,
  saldoPendienteCentavos: 300_000,
  codigoReserva: "RES-EJ7B-DNAS",
  nombreHuesped: "José Ramiro López",
  nombreHotel: "Hotel Casa Canteras",
  tipoHabitacion: "Suite Deluxe",
  fechaIngreso: "16 de agosto de 2026",
  fechaSalida: "19 de agosto de 2026",
  numPersonas: 2,
  colorPrimario: "#1d4ed8",
  linkPreCheckin: "https://example.test/precheckin",
};

describe("comprobante de pago", () => {
  it("un anticipo no afirma que el total de la reserva fue pagado", async () => {
    const html = await renderizarComprobantePago(comprobanteBase);

    expect(html).toContain("Anticipo recibido");
    expect(html).toContain("Pago recibido ahora");
    expect(html).toContain("$3,000 MXN");
    expect(html).toContain("Total pagado acumulado");
    expect(html).toContain("Total de la reserva");
    expect(html).toContain("Saldo pendiente");
    expect(html).not.toContain("Total pagado</");
    expect(html).toContain("RES-EJ7B-DNAS");
    expect(html).toContain("https://example.test/precheckin");
  });

  it("un pago final indica que el pago se completó y no queda saldo", async () => {
    const html = await renderizarComprobantePago({
      ...comprobanteBase,
      montoRecibidoCentavos: 300_000,
      totalPagadoCentavos: 600_000,
      saldoPendienteCentavos: 0,
    });

    expect(html).toContain("Pago completado");
    expect(html).toContain("Pago recibido ahora");
    expect(html).toContain("Total pagado acumulado");
    expect(html).toContain("$6,000 MXN");
    expect(html).toContain("Saldo pendiente");
    expect(html).toContain("$0 MXN");
    expect(html).not.toContain("Anticipo recibido");
  });
});

const actorAdmin = {
  usuarioPropiedadId: "usr_admin",
  propiedadId: "prop_1",
  rol: RolUsuario.ADMIN,
};

const registroExterno = {
  reservaId: "res_1",
  montoCentavos: 300_000,
  metodo: "TRANSFERENCIA" as const,
  fechaPago: new Date("2026-08-14T16:00:00Z"),
  idempotencyKey: "idem_receipt",
};

function escenarioComprobanteExterno(
  enviar: (params: Record<string, unknown>, enTransaccion: boolean) => Promise<void>
) {
  let enTransaccion = false;
  const estados: Array<{ estado: string; error: string | null }> = [];
  const pagos: PagoExternoLedger[] = [];
  const repo = {
    cargarActor: async () => actorAdmin,
    transaccion: async <T>(trabajo: (tx: unknown) => Promise<T>) => {
      enTransaccion = true;
      try {
        return await trabajo({
          adquirirLockReserva: async () => undefined,
          adquirirLockIdempotencia: async () => undefined,
          buscarResultadoIdempotencia: async () => ({ pago: null, ajuste: null }),
          cargarLedgerReserva: async () => ({
            reserva: {
              id: "res_1",
              propiedadId: "prop_1",
              estado: "CONFIRMADA",
              totalReservaCentavos: 600_000,
            },
            pagosStripe: [],
            pagosExternos: pagos,
          }),
          crearPagoExterno: async (data: Omit<PagoExternoLedger, "id" | "ajustes" | "creadoEn">) => {
            const pago = {
              ...data,
              id: "ext_1",
              ajustes: [],
              creadoEn: new Date("2026-08-14T18:00:00Z"),
            } as PagoExternoLedger;
            pagos.push(pago);
            return pago;
          },
          crearAjustePagoExterno: async () => {
            throw new Error("NO_USADO");
          },
        });
      } finally {
        enTransaccion = false;
      }
    },
    leerLedgerReserva: async () => null,
    leerDatosComprobante: async () => ({
      pago: pagos[0],
      ledger: {
        reserva: {
          id: "res_1",
          propiedadId: "prop_1",
          estado: "CONFIRMADA",
          totalReservaCentavos: 600_000,
        },
        pagosStripe: [],
        pagosExternos: pagos,
      },
      destinatario: {
        emailHuesped: "ana@example.com",
        codigoReserva: "RES-EXTERNO",
        nombreHuesped: "Ana Pérez",
        nombreHotel: "Casa Canteras",
        tipoHabitacion: "Suite",
        fechaIngreso: new Date("2026-09-10T00:00:00Z"),
        fechaSalida: new Date("2026-09-12T00:00:00Z"),
        numPersonas: 2,
      },
    }),
    actualizarEstadoComprobante: async (_pagoId: string, data: {
      estado: string;
      comprobanteEnviadoEn: Date | null;
      comprobanteError: string | null;
    }) => {
      estados.push({ estado: data.estado, error: data.comprobanteError });
      Object.assign(pagos[0], {
        estadoComprobante: data.estado,
        comprobanteEnviadoEn: data.comprobanteEnviadoEn,
        comprobanteError: data.comprobanteError,
      });
      return pagos[0];
    },
  };
  const service = crearServicioPagosExternos(repo as never, {
    ledgerHabilitado: () => true,
    enviarComprobante: (params: Record<string, unknown>) => enviar(params, enTransaccion),
    registrarErrorComprobante: () => undefined,
  } as never);
  return { estados, pagos, service };
}

describe("estado del comprobante externo", () => {
  it("mantiene NO_SOLICITADO cuando el correo no se pidió", async () => {
    let envios = 0;
    const { estados, pagos, service } = escenarioComprobanteExterno(async () => {
      envios++;
    });

    const resultado = await service.registrarPagoExterno(actorAdmin, {
      ...registroExterno,
      enviarComprobante: false,
    });

    expect(resultado.estadoComprobante).toBe("NO_SOLICITADO");
    expect(pagos).toHaveLength(1);
    expect(estados).toEqual([]);
    expect(envios).toBe(0);
  });

  it("envía fuera de la transacción y marca ENVIADO con el resumen acumulado", async () => {
    const enviados: Record<string, unknown>[] = [];
    const { estados, service } = escenarioComprobanteExterno(async (params, enTransaccion) => {
      expect(enTransaccion).toBe(false);
      enviados.push(params);
    });

    const resultado = await service.registrarPagoExterno(actorAdmin, {
      ...registroExterno,
      enviarComprobante: true,
    });

    expect(resultado.estadoComprobante).toBe("ENVIADO");
    expect(estados.map(({ estado }) => estado)).toEqual(["PENDIENTE", "ENVIADO"]);
    expect(enviados[0]).toMatchObject({
      montoRecibidoCentavos: 300_000,
      totalPagadoCentavos: 300_000,
      totalReservaCentavos: 600_000,
      saldoPendienteCentavos: 300_000,
    });
  });

  it("una falla de correo no revierte el pago y persiste un error sanitizado", async () => {
    const { estados, pagos, service } = escenarioComprobanteExterno(async (_params, enTransaccion) => {
      expect(enTransaccion).toBe(false);
      throw new Error("token_secreto_resend_123");
    });

    const resultado = await service.registrarPagoExterno(actorAdmin, {
      ...registroExterno,
      enviarComprobante: true,
    });

    expect(pagos).toHaveLength(1);
    expect(resultado.estadoComprobante).toBe("FALLIDO");
    expect(estados.map(({ estado }) => estado)).toEqual(["PENDIENTE", "FALLIDO"]);
    expect(estados[1].error).toBe("No fue posible enviar el comprobante. Intenta nuevamente.");
    expect(estados[1].error).not.toContain("token_secreto_resend_123");
  });

  it("reintenta solo el comprobante sin registrar otro pago", async () => {
    let fallar = true;
    let envios = 0;
    const { pagos, service } = escenarioComprobanteExterno(async () => {
      envios++;
      if (fallar) throw new Error("FALLO_TRANSITORIO");
    });
    const primero = await service.registrarPagoExterno(actorAdmin, {
      ...registroExterno,
      enviarComprobante: true,
    });
    expect(primero.estadoComprobante).toBe("FALLIDO");
    fallar = false;

    const reintentado = await service.reenviarComprobantePagoExterno(actorAdmin, {
      reservaId: "res_1",
      pagoExternoId: primero.id,
    });

    expect(reintentado.estadoComprobante).toBe("ENVIADO");
    expect(pagos).toHaveLength(1);
    expect(envios).toBe(2);

    await service.reenviarComprobantePagoExterno(actorAdmin, {
      reservaId: "res_1",
      pagoExternoId: primero.id,
    });
    expect(envios).toBe(3);
    expect(pagos).toHaveLength(1);
  });
});
