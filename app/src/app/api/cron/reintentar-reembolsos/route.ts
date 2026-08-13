import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reembolsarPagoDirectoHuesped, reembolsarPagoHuesped } from "@/lib/stripeConnect";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const pendientes = await prisma.pagoOnline.findMany({
    where: {
      estado: { in: ["REEMBOLSO_PENDIENTE", "REEMBOLSO_FALLIDO"] },
      reembolsoPendienteMxn: { gt: 0 },
    },
    orderBy: { actualizadoEn: "asc" },
    take: 50,
  });

  let completados = 0;
  for (const pago of pendientes) {
    const centavos = Math.round(Number(pago.reembolsoPendienteMxn) * 100);
    try {
      const idempotencyKey = `roomly-refund-${pago.id}-${Math.round(Number(pago.montoReembolsadoMxn) * 100)}-${centavos}`;
      if (pago.modeloCobro === "DIRECT" && !pago.stripeConnectAccountId) {
        throw new Error("CUENTA_ORIGEN_STRIPE_FALTANTE");
      }
      if (pago.modeloCobro === "DIRECT") {
        await reembolsarPagoDirectoHuesped(
          pago.stripePaymentIntentId,
          pago.stripeConnectAccountId!,
          centavos,
          idempotencyKey
        );
      } else {
        await reembolsarPagoHuesped(pago.stripePaymentIntentId, centavos, idempotencyKey);
      }
      const totalReembolsado = Number(pago.montoReembolsadoMxn) + centavos / 100;
      await prisma.pagoOnline.update({
        where: { id: pago.id },
        data: {
          montoReembolsadoMxn: totalReembolsado,
          reembolsoPendienteMxn: 0,
          estado: totalReembolsado + 0.005 >= Number(pago.montoMxn) ? "REEMBOLSADO" : "REEMBOLSADO_PARCIAL",
        },
      });
      completados++;
    } catch {
      await prisma.pagoOnline.update({ where: { id: pago.id }, data: { estado: "REEMBOLSO_FALLIDO" } });
    }
  }

  return NextResponse.json({ revisados: pendientes.length, completados });
}
