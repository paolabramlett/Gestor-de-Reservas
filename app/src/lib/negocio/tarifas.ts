import { prisma } from "@/lib/prisma";

export type DesglosePorNoche = {
  fecha: string;
  precio: number;
  modalidad: "POR_PERSONA" | "POR_HABITACION" | "BASE_MAS_SUPLEMENTO";
  suplementoPorPersona?: number;
  fuente: "TEMPORADA" | "TARIFA_BASE";
  temporadaNombre?: string;
};

/**
 * Precio de UNA noche según la modalidad. Función pura (sin DB) para poder
 * testearla de forma aislada:
 *  - POR_HABITACION: precio fijo por noche, sin importar personas.
 *  - POR_PERSONA: precio × número de personas.
 *  - BASE_MAS_SUPLEMENTO: la primera persona paga la base; cada persona
 *    adicional suma el suplemento.
 */
export function calcularPrecioNoche(
  noche: Pick<DesglosePorNoche, "precio" | "modalidad" | "suplementoPorPersona">,
  numPersonas: number
): number {
  const personas = Math.max(1, numPersonas);
  if (noche.modalidad === "POR_PERSONA") {
    return noche.precio * personas;
  }
  if (noche.modalidad === "BASE_MAS_SUPLEMENTO") {
    const suplemento = noche.suplementoPorPersona ?? 0;
    return noche.precio + (personas - 1) * suplemento;
  }
  // POR_HABITACION
  return noche.precio;
}

export async function calcularTarifaPorNoche(
  tipoDeHabitacionId: string,
  fecha: Date
): Promise<DesglosePorNoche> {
  const fechaStr = fecha.toISOString().split("T")[0];

  // Buscar Temporada que cubra esta fecha
  const temporada = await prisma.temporada.findFirst({
    where: {
      tipoDeHabitacionId,
      fechaInicio: { lte: fecha },
      fechaFin: { gte: fecha },
    },
  });

  if (temporada) {
    return {
      fecha: fechaStr,
      precio: Number(temporada.precio),
      modalidad: temporada.modalidad,
      suplementoPorPersona: temporada.suplementoPorPersona ? Number(temporada.suplementoPorPersona) : undefined,
      fuente: "TEMPORADA",
      temporadaNombre: temporada.nombre,
    };
  }

  // Fallback a TarifaBase
  const tipo = await prisma.tipoDeHabitacion.findUniqueOrThrow({
    where: { id: tipoDeHabitacionId },
    select: { tarifaBasePrice: true, tarifaBaseModalidad: true, suplementoPorPersona: true },
  });

  return {
    fecha: fechaStr,
    precio: Number(tipo.tarifaBasePrice),
    modalidad: tipo.tarifaBaseModalidad,
    suplementoPorPersona: tipo.suplementoPorPersona ? Number(tipo.suplementoPorPersona) : undefined,
    fuente: "TARIFA_BASE",
  };
}

export async function calcularTotalReserva(
  tipoDeHabitacionId: string,
  fechaIngreso: Date,
  fechaSalida: Date,
  numPersonas: number
): Promise<{ total: number; desglose: DesglosePorNoche[] }> {
  const desglose: DesglosePorNoche[] = [];
  const cursor = new Date(fechaIngreso);

  while (cursor < fechaSalida) {
    const tarifa = await calcularTarifaPorNoche(tipoDeHabitacionId, new Date(cursor));
    desglose.push(tarifa);
    cursor.setDate(cursor.getDate() + 1);
  }

  const total = desglose.reduce(
    (acc, noche) => acc + calcularPrecioNoche(noche, numPersonas),
    0
  );

  return { total, desglose };
}
