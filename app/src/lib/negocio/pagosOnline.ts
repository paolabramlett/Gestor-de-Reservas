type PagoRecibido = {
  paymentStatus: string | null;
  moneda: string | null;
  montoRecibidoCentavos: number | null;
  montoEsperadoCentavos: number;
};

import { prisma } from "@/lib/prisma";
import { reembolsarPagoHuesped } from "@/lib/stripeConnect";

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
}): Promise<void> {
  if ((input.reservaId ? 1 : 0) + (input.grupoId ? 1 : 0) !== 1) throw new Error("DESTINO_REEMBOLSO_INVALIDO");
  const pagos = await prisma.pagoOnline.findMany({
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
    const pago = pagos.find((p) => p.id === parte.id)!;
    await prisma.pagoOnline.update({
      where: { id: pago.id },
      data: { estado: "REEMBOLSO_PENDIENTE", reembolsoPendienteMxn: parte.montoCentavos / 100 },
    });
    try {
      await reembolsarPagoHuesped(
        pago.stripePaymentIntentId,
        parte.montoCentavos,
        `roomly-refund-${pago.id}-${Math.round(Number(pago.montoReembolsadoMxn) * 100)}-${parte.montoCentavos}`
      );
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
