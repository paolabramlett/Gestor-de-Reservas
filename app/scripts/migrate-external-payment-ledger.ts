import { open } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
// Node ejecuta este script con type stripping y necesita la extensión real.
// @ts-expect-error TS5097: el runtime sí admite imports .ts en este comando.
import { clasificarPagoManualLegacy } from "../src/lib/negocio/migracionPagosExternos.ts";
// @ts-expect-error TS5097: el runtime sí admite imports .ts en este comando.
import { aCentavos, aMxn, calcularResumenFinanciero } from "../src/lib/negocio/resumenFinanciero.ts";

export type ClasificacionMigracion =
  | "CONCILIABLE"
  | "SIN_MOVIMIENTO"
  | "REVISION_MANUAL"
  | "YA_MIGRADO"
  | "APLICADO";

type PagoStripeCentavos = {
  cobradoCentavos: number;
  reembolsadoCentavos: number;
  reembolsoPendienteCentavos: number;
};

type PagoExternoCentavos = {
  cobradoCentavos: number;
  ajustesCentavos: number;
};

export type FilaPagoManualLegacy = {
  pagoManualId: string;
  reservaId: string;
  propiedadId: string;
  estado: string;
  montoAnticipoCentavos: number | null;
  totalCentavos: number;
  fechaPago: Date;
  nota: string | null;
  pagosStripe: PagoStripeCentavos[];
  pagosExternos: PagoExternoCentavos[];
  pagoExternoMigradoId: string | null;
};

export type PagoExternoMigrable = {
  pagoManualId: string;
  reservaId: string;
  propiedadId: string;
  montoCentavos: number;
  fechaPago: Date;
  nota: string | null;
  idempotencyKey: string;
};

export type FilaReporteMigracion = {
  pagoManualId: string;
  reservaId: string;
  propiedadId: string;
  pagoExternoId?: string;
  clasificacion: ClasificacionMigracion;
  totalReservaCentavos: number;
  stripeNetoCentavos: number;
  externoActualCentavos: number;
  montoMigracionCentavos: number;
  pagadoProyectadoCentavos: number;
  diferenciaCentavos: number;
};

export type ReporteMigracion = {
  resumen: Record<ClasificacionMigracion, number>;
  filas: FilaReporteMigracion[];
};

type OpcionesEjecucion = {
  aplicar: boolean;
  insertarSiAusente(pago: PagoExternoMigrable): Promise<string | null>;
};

type PagoManualConsulta = {
  id: string;
  estadoDePago: string;
  montoAnticipo: unknown | null;
  notas: string | null;
  actualizadoEn: Date;
  reserva: {
    id: string;
    propiedadId: string;
    totalMxn: unknown;
    pagosOnline: Array<{
      montoMxn: unknown;
      montoReembolsadoMxn: unknown;
      reembolsoPendienteMxn: unknown;
    }>;
    pagosExternos: Array<{
      id: string;
      montoMxn: unknown;
      idempotencyKey: string;
      ajustes: Array<{ montoMxn: unknown }>;
    }>;
  };
};

type ClienteLectura = {
  pagoManual: {
    findMany(argumentos: object): Promise<PagoManualConsulta[]>;
  };
};

const clasificaciones: ClasificacionMigracion[] = [
  "CONCILIABLE",
  "SIN_MOVIMIENTO",
  "REVISION_MANUAL",
  "YA_MIGRADO",
  "APLICADO",
];

function idempotencyKeyLegacy(pagoManualId: string): string {
  return `legacy-pago-manual:${pagoManualId}`;
}

function prepararFila(fila: FilaPagoManualLegacy): {
  reporte: FilaReporteMigracion;
  pago: PagoExternoMigrable | null;
} {
  const resumenActual = calcularResumenFinanciero({
    totalReservaCentavos: fila.totalCentavos,
    pagosStripe: fila.pagosStripe,
    pagosExternos: fila.pagosExternos,
  });
  const candidato = clasificarPagoManualLegacy({
    estado: fila.estado,
    montoAnticipoCentavos: fila.montoAnticipoCentavos,
    totalCentavos: fila.totalCentavos,
    stripeNetoCentavos: resumenActual.stripeNetoCentavos,
    nota: fila.nota,
  });
  const montoMigracionCentavos = candidato?.montoCentavos ?? 0;
  const resumenEsperado = calcularResumenFinanciero({
    totalReservaCentavos: fila.totalCentavos,
    pagosStripe: fila.pagosStripe,
    pagosExternos: candidato
      ? [{ cobradoCentavos: candidato.montoCentavos, ajustesCentavos: 0 }]
      : [],
  });
  const resumenProyectado = calcularResumenFinanciero({
    totalReservaCentavos: fila.totalCentavos,
    pagosStripe: fila.pagosStripe,
    pagosExternos: fila.pagoExternoMigradoId || !candidato?.requiereRevision
      ? [
          ...fila.pagosExternos,
          ...(fila.pagoExternoMigradoId || !candidato
            ? []
            : [{ cobradoCentavos: candidato.montoCentavos, ajustesCentavos: 0 }]),
        ]
      : fila.pagosExternos,
  });
  const clasificacion: ClasificacionMigracion = fila.pagoExternoMigradoId
    ? "YA_MIGRADO"
    : !candidato
      ? "SIN_MOVIMIENTO"
      : candidato.requiereRevision
        ? "REVISION_MANUAL"
        : "CONCILIABLE";
  const reporte: FilaReporteMigracion = {
    pagoManualId: fila.pagoManualId,
    reservaId: fila.reservaId,
    propiedadId: fila.propiedadId,
    ...(fila.pagoExternoMigradoId ? { pagoExternoId: fila.pagoExternoMigradoId } : {}),
    clasificacion,
    totalReservaCentavos: fila.totalCentavos,
    stripeNetoCentavos: resumenActual.stripeNetoCentavos,
    externoActualCentavos: resumenActual.externoNetoCentavos,
    montoMigracionCentavos,
    pagadoProyectadoCentavos: resumenProyectado.pagadoNetoCentavos,
    diferenciaCentavos:
      resumenProyectado.pagadoNetoCentavos - resumenEsperado.pagadoNetoCentavos,
  };

  if (clasificacion !== "CONCILIABLE" || !candidato) return { reporte, pago: null };
  return {
    reporte,
    pago: {
      pagoManualId: fila.pagoManualId,
      reservaId: fila.reservaId,
      propiedadId: fila.propiedadId,
      montoCentavos: candidato.montoCentavos,
      fechaPago: fila.fechaPago,
      nota: fila.nota,
      idempotencyKey: idempotencyKeyLegacy(fila.pagoManualId),
    },
  };
}

function resumir(filas: FilaReporteMigracion[]): ReporteMigracion {
  const resumen = Object.fromEntries(
    clasificaciones.map((clasificacion) => [clasificacion, 0])
  ) as Record<ClasificacionMigracion, number>;
  for (const fila of filas) resumen[fila.clasificacion] += 1;
  return { resumen, filas };
}

export function construirReporteMigracion(filas: FilaPagoManualLegacy[]): ReporteMigracion {
  return resumir(filas.map((fila) => prepararFila(fila).reporte));
}

export async function ejecutarMigracion(
  filas: FilaPagoManualLegacy[],
  opciones: OpcionesEjecucion
): Promise<ReporteMigracion> {
  const reporte: FilaReporteMigracion[] = [];
  for (const fila of filas) {
    const preparada = prepararFila(fila);
    if (!opciones.aplicar || !preparada.pago) {
      reporte.push(preparada.reporte);
      continue;
    }
    const pagoExternoId = await opciones.insertarSiAusente(preparada.pago);
    reporte.push({
      ...preparada.reporte,
      ...(pagoExternoId ? { pagoExternoId } : {}),
      clasificacion: pagoExternoId ? "APLICADO" : "YA_MIGRADO",
    });
  }
  return resumir(reporte);
}

export function validarGuardasCli(
  argumentos: string[],
  stripeSecretKey: string | undefined
): { aplicar: boolean } {
  const aplicar = argumentos.includes("--apply");
  if (aplicar && !argumentos.includes("--sandbox-confirmed")) {
    throw new Error("APPLY_REQUIERE_--sandbox-confirmed");
  }
  if (stripeSecretKey?.startsWith("sk_live_") && !argumentos.includes("--allow-live")) {
    throw new Error("STRIPE_LIVE_REQUIERE_--allow-live");
  }
  return { aplicar };
}

async function escribirReporteSeguro(ruta: string, contenido: unknown): Promise<void> {
  const archivo = await open(ruta, "w", 0o600);
  try {
    await archivo.chmod(0o600);
    await archivo.writeFile(`${JSON.stringify(contenido, null, 2)}\n`, "utf8");
  } finally {
    await archivo.close();
  }
}

async function cargarFilas(prisma: ClienteLectura): Promise<FilaPagoManualLegacy[]> {
  const pagosManuales = await prisma.pagoManual.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      estadoDePago: true,
      montoAnticipo: true,
      notas: true,
      actualizadoEn: true,
      reserva: {
        select: {
          id: true,
          propiedadId: true,
          totalMxn: true,
          pagosOnline: {
            select: {
              montoMxn: true,
              montoReembolsadoMxn: true,
              reembolsoPendienteMxn: true,
            },
          },
          pagosExternos: {
            select: {
              id: true,
              montoMxn: true,
              idempotencyKey: true,
              ajustes: { select: { montoMxn: true } },
            },
          },
        },
      },
    },
  });

  return pagosManuales.map((pago) => {
    const clave = idempotencyKeyLegacy(pago.id);
    return {
      pagoManualId: pago.id,
      reservaId: pago.reserva.id,
      propiedadId: pago.reserva.propiedadId,
      estado: pago.estadoDePago,
      montoAnticipoCentavos: pago.montoAnticipo === null
        ? null
        : aCentavos(Number(pago.montoAnticipo)),
      totalCentavos: aCentavos(Number(pago.reserva.totalMxn)),
      fechaPago: pago.actualizadoEn,
      nota: pago.notas,
      pagosStripe: pago.reserva.pagosOnline.map((stripe) => ({
        cobradoCentavos: aCentavos(Number(stripe.montoMxn)),
        reembolsadoCentavos: aCentavos(Number(stripe.montoReembolsadoMxn)),
        reembolsoPendienteCentavos: aCentavos(Number(stripe.reembolsoPendienteMxn)),
      })),
      pagosExternos: pago.reserva.pagosExternos.map((externo) => ({
        cobradoCentavos: aCentavos(Number(externo.montoMxn)),
        ajustesCentavos: externo.ajustes.reduce(
          (total, ajuste) => total + aCentavos(Number(ajuste.montoMxn)),
          0
        ),
      })),
      pagoExternoMigradoId:
        pago.reserva.pagosExternos.find((externo) => externo.idempotencyKey === clave)?.id ?? null,
    };
  });
}

async function main(): Promise<void> {
  dotenv.config({ path: resolve(process.cwd(), ".env.local"), quiet: true });
  dotenv.config({ path: resolve(process.cwd(), ".env"), quiet: true });
  const { aplicar } = validarGuardasCli(process.argv.slice(2), process.env.STRIPE_SECRET_KEY);
  const databaseUrl = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("FALTA_DATABASE_URL");

  const [{ PrismaClient }, { PrismaPg }] = await Promise.all([
    import("@prisma/client"),
    import("@prisma/adapter-pg"),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    const filas = await cargarFilas(prisma);
    const reporte = await ejecutarMigracion(filas, {
      aplicar,
      async insertarSiAusente(pago) {
        const resultado = await prisma.pagoExterno.createMany({
          data: [{
            propiedadId: pago.propiedadId,
            reservaId: pago.reservaId,
            montoMxn: aMxn(pago.montoCentavos),
            metodo: "OTRO",
            fechaPago: pago.fechaPago,
            nota: pago.nota,
            creadoPorUsuarioId: null,
            idempotencyKey: pago.idempotencyKey,
            reemplazaPagoExternoId: null,
            estadoComprobante: "NO_SOLICITADO",
          }],
          skipDuplicates: true,
        });
        if (resultado.count === 0) return null;
        const creado = await prisma.pagoExterno.findUnique({
          where: { idempotencyKey: pago.idempotencyKey },
          select: { id: true },
        });
        if (!creado) throw new Error("PAGO_APLICADO_NO_ENCONTRADO");
        return creado.id;
      },
    });
    const modo = aplicar ? "APPLY" : "DRY_RUN";
    const salida = resolve(process.cwd(), ".external-payment-ledger-report.json");
    await escribirReporteSeguro(salida, { modo, resumen: reporte.resumen, filas: reporte.filas });
    process.stdout.write(`${JSON.stringify({ modo, resumen: reporte.resumen })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

const entrada = process.argv[1];
if (entrada && import.meta.url === pathToFileURL(resolve(entrada)).href) {
  main().catch((error: unknown) => {
    const mensajesSeguros = new Set([
      "APPLY_REQUIERE_--sandbox-confirmed",
      "STRIPE_LIVE_REQUIERE_--allow-live",
      "FALTA_DATABASE_URL",
      "PAGO_APLICADO_NO_ENCONTRADO",
    ]);
    const mensaje = error instanceof Error && mensajesSeguros.has(error.message)
      ? error.message
      : "MIGRACION_FALLIDA";
    process.stderr.write(`${mensaje}\n`);
    process.exitCode = 1;
  });
}
