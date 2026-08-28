import { describe, expect, it } from "vitest";
import { crearVistaLedger, type PagoLedgerInput } from "./PagoLedger";

const base: PagoLedgerInput = {
  reservaId: "res_1",
  rol: "ADMIN",
  totalReservaCentavos: 600_000,
  pagadoNetoCentavos: 300_000,
  saldoPendienteCentavos: 300_000,
  estado: "PAGO_PARCIAL",
  pagosStripe: [
    {
      id: "stripe_1",
      cobradoCentavos: 300_000,
      reembolsadoCentavos: 0,
      reembolsoPendienteCentavos: 0,
      creadoEn: "2026-08-14T12:00:00.000Z",
    },
  ],
  pagosExternos: [],
};

describe("crearVistaLedger", () => {
  it("muestra el estado derivado y el movimiento Stripe como no editable", () => {
    const vista = crearVistaLedger(base);

    expect(vista).toMatchObject({
      estado: "Pago parcial",
      total: "$6,000 MXN",
      totalPagado: "$3,000 MXN",
      saldoPendiente: "$3,000 MXN",
      puedeRegistrarExterno: true,
    });
    expect(vista.movimientos[0]).toMatchObject({
      fuente: "Stripe",
      editable: false,
      detalle: "Conciliado automáticamente por Stripe",
    });
  });

  it("deja FINANZAS completamente en modo lectura", () => {
    const vista = crearVistaLedger({
      ...base,
      rol: "FINANZAS",
      pagosStripe: [],
      pagosExternos: [
        {
          id: "ext_1",
          montoCentavos: 300_000,
          metodo: "TRANSFERENCIA",
          fechaPago: "2026-08-14T15:30:00.000Z",
          nota: "Transferencia confirmada",
          autor: "Ana Recepción",
          estadoComprobante: "ENVIADO",
          reemplazaPagoExternoId: null,
          ajustes: [],
        },
      ],
    });

    expect(vista.puedeRegistrarExterno).toBe(false);
    expect(vista.movimientos[0]).toMatchObject({
      editable: false,
      controles: [],
    });
  });

  it("explica un reembolso total de Stripe sin mostrarlo como pago inexistente", () => {
    const vista = crearVistaLedger({
      ...base,
      pagadoNetoCentavos: 0,
      saldoPendienteCentavos: 300_000,
      pagosStripe: [{ ...base.pagosStripe[0], reembolsadoCentavos: 300_000 }],
    });

    expect(vista.movimientos[0]).toMatchObject({
      monto: "$0 MXN",
      montoOriginal: "$3,000 MXN",
      montoReembolsado: "$3,000 MXN",
      montoAplicado: "$0 MXN",
      estadoReembolso: "Reembolsado por Stripe",
    });
  });

  it("conserva el pago externo original y sus ajustes vinculados en la auditoría", () => {
    const vista = crearVistaLedger({
      ...base,
      pagosStripe: [],
      pagosExternos: [
        {
          id: "ext_ajustado",
          montoCentavos: 200_000,
          metodo: "EFECTIVO",
          fechaPago: "2026-08-14T15:30:00.000Z",
          nota: "Captura original",
          autor: "Luis Reservaciones",
          estadoComprobante: "NO_SOLICITADO",
          reemplazaPagoExternoId: null,
          ajustes: [
            {
              id: "aj_1",
              tipo: "REEMBOLSO",
              montoCentavos: 50_000,
              motivo: "Devolución parcial acordada",
              autor: "Ana Admin",
              creadoEn: "2026-08-15T10:00:00.000Z",
            },
          ],
        },
      ],
    });

    expect(vista.movimientos).toHaveLength(1);
    expect(vista.movimientos[0]).toMatchObject({
      id: "ext_ajustado",
      fuente: "Pago externo",
      autor: "Luis Reservaciones",
      nota: "Captura original",
      ajustes: [
        {
          id: "aj_1",
          tipo: "REEMBOLSO",
          monto: "$500 MXN",
          motivo: "Devolución parcial acordada",
          autor: "Ana Admin",
        },
      ],
    });
  });

  it("ofrece reenvío sólo para comprobantes fallidos o enviados sin registrar otro pago", () => {
    const pago = {
      id: "ext_1",
      montoCentavos: 100_000,
      metodo: "EFECTIVO" as const,
      fechaPago: "2026-08-14T15:30:00.000Z",
      nota: null,
      autor: "Ana Admin",
      reemplazaPagoExternoId: null,
      ajustes: [{
        id: "aj_total",
        tipo: "ANULACION" as const,
        montoCentavos: 100_000,
        motivo: "Captura duplicada",
        autor: "Ana Admin",
        creadoEn: "2026-08-15T10:00:00.000Z",
      }],
    };

    const enviado = crearVistaLedger({
      ...base,
      pagosStripe: [],
      pagosExternos: [{ ...pago, estadoComprobante: "ENVIADO" }],
    });
    const pendiente = crearVistaLedger({
      ...base,
      pagosStripe: [],
      pagosExternos: [{ ...pago, estadoComprobante: "PENDIENTE" }],
    });

    expect(enviado.movimientos[0]).toMatchObject({ controles: ["REENVIAR"] });
    expect(pendiente.movimientos[0]).toMatchObject({ controles: [] });
  });
});
