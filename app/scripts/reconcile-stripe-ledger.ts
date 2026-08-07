import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import Stripe from "stripe";
// Node 24 ejecuta este script con type stripping y necesita la extensión real.
// @ts-expect-error TS5097: el runtime sí admite imports .ts en este comando.
import { clasificarPagoLegacy, type IntentStripeNormalizado } from "../src/lib/negocio/reconciliacionStripe.ts";

dotenv.config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
dotenv.config({ path: resolve(process.cwd(), ".env"), quiet: true });

const aplicar = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL;
const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!databaseUrl || !stripeKey) throw new Error("FALTAN_CREDENCIALES_DE_CONCILIACION");
if (stripeKey.startsWith("sk_live_") && !process.argv.includes("--allow-live")) {
  throw new Error("STRIPE_LIVE_REQUIERE_--allow-live");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const stripe = new Stripe(stripeKey, { apiVersion: "2026-06-24.dahlia" });

type Candidato = {
  tipo: "RESERVA" | "GRUPO";
  destinoId: string;
  propiedadId: string;
  cuentaConnectEsperada: string | null;
  paymentIntentId: string;
};

type FilaReporte = {
  paymentIntentId: string;
  tipo: Candidato["tipo"];
  destinoId: string;
  estado: "CONCILIABLE" | "YA_CONCILIADO" | "REVISION_MANUAL" | "APLICADO";
  motivo?: string;
  montoCentavos?: number;
  montoReembolsadoCentavos?: number;
};

async function normalizarIntent(paymentIntentId: string): Promise<IntentStripeNormalizado | null> {
  try {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
    const charge = intent.latest_charge && typeof intent.latest_charge !== "string"
      ? intent.latest_charge
      : intent.latest_charge
        ? await stripe.charges.retrieve(intent.latest_charge)
        : null;
    const destino = typeof intent.transfer_data?.destination === "string"
      ? intent.transfer_data.destination
      : intent.transfer_data?.destination?.id ?? null;
    return {
      status: intent.status,
      moneda: intent.currency,
      montoRecibidoCentavos: intent.amount_received,
      montoReembolsadoCentavos: charge?.amount_refunded ?? 0,
      propiedadIdMetadata: intent.metadata?.propiedadId ?? null,
      cuentaConnectDestino: destino,
    };
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError && error.statusCode === 404) return null;
    throw error;
  }
}

async function main() {
  const [reservas, grupos, pagosExistentes] = await Promise.all([
    prisma.reserva.findMany({
      where: { stripePaymentIntentId: { not: null } },
      select: {
        id: true,
        propiedadId: true,
        stripePaymentIntentId: true,
        propiedad: { select: { stripeConnectAccountId: true } },
      },
    }),
    prisma.grupoReserva.findMany({
      where: { stripePaymentIntentId: { not: null } },
      select: {
        id: true,
        propiedadId: true,
        stripePaymentIntentId: true,
        propiedad: { select: { stripeConnectAccountId: true } },
      },
    }),
    prisma.pagoOnline.findMany({ select: { stripePaymentIntentId: true } }),
  ]);

  const candidatos: Candidato[] = [
    ...reservas.map((reserva) => ({
      tipo: "RESERVA" as const,
      destinoId: reserva.id,
      propiedadId: reserva.propiedadId,
      cuentaConnectEsperada: reserva.propiedad.stripeConnectAccountId,
      paymentIntentId: reserva.stripePaymentIntentId!,
    })),
    ...grupos.map((grupo) => ({
      tipo: "GRUPO" as const,
      destinoId: grupo.id,
      propiedadId: grupo.propiedadId,
      cuentaConnectEsperada: grupo.propiedad.stripeConnectAccountId,
      paymentIntentId: grupo.stripePaymentIntentId!,
    })),
  ];
  const idsRepetidos = new Set(
    candidatos
      .filter((candidato, index) => candidatos.findIndex((otro) => otro.paymentIntentId === candidato.paymentIntentId) !== index)
      .map((candidato) => candidato.paymentIntentId)
  );
  const conciliados = new Set(pagosExistentes.map((pago) => pago.stripePaymentIntentId));
  const reporte: FilaReporte[] = [];

  for (const candidato of candidatos) {
    if (idsRepetidos.has(candidato.paymentIntentId)) {
      reporte.push({
        paymentIntentId: candidato.paymentIntentId,
        tipo: candidato.tipo,
        destinoId: candidato.destinoId,
        estado: "REVISION_MANUAL",
        motivo: "PAYMENT_INTENT_ASOCIADO_A_VARIOS_DESTINOS",
      });
      continue;
    }
    const intent = conciliados.has(candidato.paymentIntentId)
      ? null
      : await normalizarIntent(candidato.paymentIntentId);
    const resultado = clasificarPagoLegacy({
      yaConciliado: conciliados.has(candidato.paymentIntentId),
      propiedadIdEsperada: candidato.propiedadId,
      cuentaConnectEsperada: candidato.cuentaConnectEsperada,
      intent,
    });
    const fila: FilaReporte = {
      paymentIntentId: candidato.paymentIntentId,
      tipo: candidato.tipo,
      destinoId: candidato.destinoId,
      ...resultado,
    };
    if (aplicar && resultado.estado === "CONCILIABLE") {
      const esReembolsoCompleto = resultado.montoReembolsadoCentavos === resultado.montoCentavos;
      const esReembolsoParcial = resultado.montoReembolsadoCentavos > 0 && !esReembolsoCompleto;
      await prisma.pagoOnline.create({
        data: {
          propiedadId: candidato.propiedadId,
          ...(candidato.tipo === "RESERVA" ? { reservaId: candidato.destinoId } : { grupoId: candidato.destinoId }),
          stripePaymentIntentId: candidato.paymentIntentId,
          montoMxn: resultado.montoCentavos / 100,
          moneda: "mxn",
          montoReembolsadoMxn: resultado.montoReembolsadoCentavos / 100,
          estado: esReembolsoCompleto ? "REEMBOLSADO" : esReembolsoParcial ? "REEMBOLSADO_PARCIAL" : "PAGADO",
        },
      });
      fila.estado = "APLICADO";
    }
    reporte.push(fila);
  }

  const resumen = reporte.reduce<Record<string, number>>((conteo, fila) => {
    conteo[fila.estado] = (conteo[fila.estado] ?? 0) + 1;
    return conteo;
  }, {});
  const salida = resolve(process.cwd(), ".stripe-reconciliation-report.json");
  await writeFile(salida, `${JSON.stringify({ modo: aplicar ? "APPLY" : "DRY_RUN", resumen, pagos: reporte }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ modo: aplicar ? "APPLY" : "DRY_RUN", resumen, reporte: salida }));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
