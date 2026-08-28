type PagoRecibido = {
  paymentStatus: string | null;
  moneda: string | null;
  montoRecibidoCentavos: number | null;
  montoEsperadoCentavos: number;
};

type PagoManualResumen = {
  estadoDePago: string;
  montoAnticipo: unknown;
} | null;

type PagoOnlineResumen = {
  estado: string;
  montoMxn: unknown;
  montoReembolsadoMxn: unknown;
  reembolsoPendienteMxn: unknown;
};

export type ResumenPagoReserva = {
  montoPagadoMxn: number;
  montoStripeMxn: number;
  montoExternoMxn: number;
  saldoPendienteMxn: number;
  pagoCompleto: boolean;
  metodo: "Stripe" | "Pago externo" | "Stripe + pago externo" | "Sin pagos";
};

import { prisma } from "@/lib/prisma";
import { reembolsarPagoDirectoHuesped, reembolsarPagoHuesped } from "@/lib/stripeConnect";
import { aCentavos, aMxn, calcularResumenFinanciero } from "./resumenFinanciero";

export function calcularResumenPagoReserva(input: {
  totalMxn: number;
  pagoManual: PagoManualResumen;
  pagosOnline: PagoOnlineResumen[];
}): ResumenPagoReserva {
  const totalMxn = Math.max(0, Number(input.totalMxn) || 0);
  const montoExternoMxn = input.pagoManual?.estadoDePago === "PAGADO_COMPLETO"
    ? Number(input.pagoManual.montoAnticipo) > 0
      ? Math.max(0, Number(input.pagoManual.montoAnticipo))
      : totalMxn
    : input.pagoManual?.estadoDePago === "ANTICIPO_PAGADO"
      ? Math.max(0, Number(input.pagoManual.montoAnticipo) || 0)
      : 0;
  const resumen = calcularResumenFinanciero({
    totalReservaCentavos: aCentavos(totalMxn),
    pagosStripe: input.pagosOnline.map((pago) => ({
      cobradoCentavos: pago.estado === "REEMBOLSADO" ? 0 : aCentavos(Number(pago.montoMxn) || 0),
      reembolsadoCentavos: pago.estado === "REEMBOLSADO" ? 0 : aCentavos(Number(pago.montoReembolsadoMxn) || 0),
      reembolsoPendienteCentavos: pago.estado === "REEMBOLSADO" ? 0 : aCentavos(Number(pago.reembolsoPendienteMxn) || 0),
    })),
    pagosExternos: [{ cobradoCentavos: aCentavos(montoExternoMxn), ajustesCentavos: 0 }],
  });
  const montoStripeMxn = aMxn(resumen.stripeNetoCentavos);
  const montoExternoResumenMxn = aMxn(resumen.externoNetoCentavos);
  const montoPagadoMxn = aMxn(resumen.pagadoNetoCentavos);
  const saldoPendienteMxn = aMxn(resumen.saldoPendienteCentavos);
  const pagoCompleto = resumen.estado === "PAGO_COMPLETO";
  const metodo = montoStripeMxn > 0 && montoExternoResumenMxn > 0
    ? "Stripe + pago externo"
    : montoStripeMxn > 0
      ? "Stripe"
      : montoExternoResumenMxn > 0
        ? "Pago externo"
        : "Sin pagos";

  return {
    montoPagadoMxn,
    montoStripeMxn,
    montoExternoMxn: montoExternoResumenMxn,
    saldoPendienteMxn,
    pagoCompleto,
    metodo,
  };
}

export function validarPagoRecibido(input: PagoRecibido): void {
  if (
    input.paymentStatus !== "paid" ||
    input.moneda?.toLowerCase() !== "mxn" ||
    !Number.isInteger(input.montoRecibidoCentavos) ||
    input.montoRecibidoCentavos !== input.montoEsperadoCentavos ||
    input.montoEsperadoCentavos <= 0
  ) {
    throw new Error("PAGO_STRIPE_INCONSISTENTE");
  }
}

export function montoCentavos(montoMxn: number): number {
  if (!Number.isFinite(montoMxn) || montoMxn <= 0) throw new Error("MONTO_INVALIDO");
  return Math.round(montoMxn * 100);
}

export function validarDestinoPago(destinoRecibido: string | null, destinoEsperado: string): void {
  if (!destinoEsperado || destinoRecibido !== destinoEsperado) {
    throw new Error("DESTINO_STRIPE_INCONSISTENTE");
  }
}

// Los eventos de Connect deben llevar explícitamente la cuenta propietaria
// del objeto Stripe; no basta con metadata que pueda venir de otra cuenta.
export function validarCuentaEvento(cuentaRecibida: string | null, cuentaEsperada: string): void {
  if (!cuentaEsperada || cuentaRecibida !== cuentaEsperada) {
    throw new Error("CUENTA_EVENTO_STRIPE_INCONSISTENTE");
  }
}

export function distribuirReembolso(
  montoCentavosSolicitado: number,
  pagos: Array<{ id: string; disponibleCentavos: number }>
): Array<{ id: string; montoCentavos: number }> {
  if (!Number.isInteger(montoCentavosSolicitado) || montoCentavosSolicitado <= 0) throw new Error("MONTO_INVALIDO");
  let restante = montoCentavosSolicitado;
  const distribucion: Array<{ id: string; montoCentavos: number }> = [];
  for (const pago of pagos) {
    if (restante <= 0) break;
    const monto = Math.min(restante, Math.max(0, pago.disponibleCentavos));
    if (monto > 0) distribucion.push({ id: pago.id, montoCentavos: monto });
    restante -= monto;
  }
  if (restante > 0) throw new Error("SALDO_INSUFICIENTE_PARA_REEMBOLSO");
  return distribucion;
}

export async function reembolsarPagosOnline(input: {
  reservaId?: string;
  grupoId?: string;
  montoMxn: number;
  motivo?: string;
}): Promise<void> {
  if ((input.reservaId ? 1 : 0) + (input.grupoId ? 1 : 0) !== 1) throw new Error("DESTINO_REEMBOLSO_INVALIDO");
  const claveLock = input.reservaId ?? input.grupoId!;
  const { pagos, distribucion } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${claveLock}, 7))`;
    const pagos = await tx.pagoOnline.findMany({
      where: {
        ...(input.reservaId ? { reservaId: input.reservaId } : { grupoId: input.grupoId }),
        estado: { in: ["PAGADO", "REEMBOLSADO_PARCIAL"] },
      },
      orderBy: { creadoEn: "desc" },
    });
    const distribucion = distribuirReembolso(
      montoCentavos(input.montoMxn),
      pagos.map((pago) => ({
        id: pago.id,
        disponibleCentavos: montoCentavos(Number(pago.montoMxn)) - Math.round(Number(pago.montoReembolsadoMxn) * 100),
      }))
    );
    for (const parte of distribucion) {
      await tx.pagoOnline.update({
        where: { id: parte.id },
        data: { estado: "REEMBOLSO_PENDIENTE", reembolsoPendienteMxn: parte.montoCentavos / 100 },
      });
    }
    return { pagos, distribucion };
  });

  for (const parte of distribucion) {
    const pago = pagos.find((p) => p.id === parte.id)!;
    try {
      const idempotencyKey = `roomly-refund-${pago.id}-${Math.round(Number(pago.montoReembolsadoMxn) * 100)}-${parte.montoCentavos}`;
      if (pago.modeloCobro === "DIRECT" && !pago.stripeConnectAccountId) {
        throw new Error("CUENTA_ORIGEN_STRIPE_FALTANTE");
      }
      if (pago.modeloCobro === "DIRECT") {
        if (input.motivo) {
          await reembolsarPagoDirectoHuesped(pago.stripePaymentIntentId, pago.stripeConnectAccountId!, parte.montoCentavos, idempotencyKey, input.motivo);
        } else {
          await reembolsarPagoDirectoHuesped(pago.stripePaymentIntentId, pago.stripeConnectAccountId!, parte.montoCentavos, idempotencyKey);
        }
      } else {
        if (input.motivo) {
          await reembolsarPagoHuesped(pago.stripePaymentIntentId, parte.montoCentavos, idempotencyKey, input.motivo);
        } else {
          await reembolsarPagoHuesped(pago.stripePaymentIntentId, parte.montoCentavos, idempotencyKey);
        }
      }
      const nuevoReembolsado = Number(pago.montoReembolsadoMxn) + parte.montoCentavos / 100;
      await prisma.pagoOnline.update({
        where: { id: pago.id },
        data: {
          montoReembolsadoMxn: nuevoReembolsado,
          reembolsoPendienteMxn: 0,
          estado: nuevoReembolsado + 0.005 >= Number(pago.montoMxn) ? "REEMBOLSADO" : "REEMBOLSADO_PARCIAL",
        },
      });
    } catch (error) {
      await prisma.pagoOnline.update({ where: { id: pago.id }, data: { estado: "REEMBOLSO_FALLIDO" } });
      throw error;
    }
  }
}
