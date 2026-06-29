import { prisma } from "@/lib/prisma";

export type DesglosePorNoche = {
  fecha: string; // ISO date YYYY-MM-DD
  precio: number;
  modalidad: "POR_PERSONA" | "POR_HABITACION";
  fuente: "TEMPORADA" | "TARIFA_BASE";
  temporadaNombre?: string;
};

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
      fuente: "TEMPORADA",
      temporadaNombre: temporada.nombre,
    };
  }

  // Fallback a TarifaBase
  const tipo = await prisma.tipoDeHabitacion.findUniqueOrThrow({
    where: { id: tipoDeHabitacionId },
    select: { tarifaBasePrice: true, tarifaBaseModalidad: true },
  });

  return {
    fecha: fechaStr,
    precio: Number(tipo.tarifaBasePrice),
    modalidad: tipo.tarifaBaseModalidad,
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

  const total = desglose.reduce((acc, noche) => {
    const precio =
      noche.modalidad === "POR_PERSONA" ? noche.precio * numPersonas : noche.precio;
    return acc + precio;
  }, 0);

  return { total, desglose };
}
