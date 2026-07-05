import { prisma } from "@/lib/prisma";
import { EstadoReserva, Prisma } from "@prisma/client";

export type ResultadoDisponibilidad = {
  tipoDeHabitacionId: string;
  nombre: string;
  descripcion: string | null;
  capacidadMin: number;
  capacidadMax: number;
  fotos: string[];
  amenidades: string[];
  habitacionesDisponibles: number;
  totalHabitaciones: number;
};

export async function calcularDisponibilidad(
  tipoDeHabitacionId: string,
  fechaIngreso: Date,
  fechaSalida: Date
): Promise<number> {
  const tipo = await prisma.tipoDeHabitacion.findUniqueOrThrow({
    where: { id: tipoDeHabitacionId },
    include: { habitaciones: { where: { activa: true } } },
  });

  const estadosOcupados: EstadoReserva[] = [
    EstadoReserva.CONFIRMADA,
    EstadoReserva.EN_CURSO,
  ];

  let habitacionesOcupadas = 0;

  for (const habitacion of tipo.habitaciones) {
    // Verificar reservas solapadas
    const reservaSolapada = await prisma.reserva.findFirst({
      where: {
        asignacion: { habitacionId: habitacion.id },
        estado: { in: estadosOcupados },
        fechaIngreso: { lt: fechaSalida },
        fechaSalida: { gt: fechaIngreso },
      },
    });

    // Verificar bloqueos solapados
    const bloqueoSolapado = await prisma.bloqueoDeHabitacion.findFirst({
      where: {
        habitacionId: habitacion.id,
        fechaInicio: { lt: fechaSalida },
        fechaFin: { gt: fechaIngreso },
      },
    });

    if (reservaSolapada || bloqueoSolapado) {
      habitacionesOcupadas++;
    }
  }

  return tipo.habitaciones.length - habitacionesOcupadas;
}

export async function buscarDisponibilidad(
  propiedadId: string,
  fechaIngreso: Date,
  fechaSalida: Date,
  numPersonas: number
): Promise<ResultadoDisponibilidad[]> {
  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: {
      propiedadId,
      activo: true,
      capacidadMin: { lte: numPersonas },
      capacidadMax: { gte: numPersonas },
      // Excluir tipos con BloqueoDetipo activo
      bloqueosDeTipo: {
        none: {
          fechaInicio: { lte: fechaSalida },
          fechaFin: { gte: fechaIngreso },
        },
      },
    },
  });

  const resultados: ResultadoDisponibilidad[] = [];

  for (const tipo of tipos) {
    const disponibles = await calcularDisponibilidad(
      tipo.id,
      fechaIngreso,
      fechaSalida
    );

    if (disponibles > 0) {
      const totalHabitaciones = await prisma.habitacion.count({
        where: { tipoDeHabitacionId: tipo.id, activa: true },
      });

      resultados.push({
        tipoDeHabitacionId: tipo.id,
        nombre: tipo.nombre,
        descripcion: tipo.descripcion,
        capacidadMin: tipo.capacidadMin,
        capacidadMax: tipo.capacidadMax,
        fotos: tipo.fotos,
        amenidades: tipo.amenidades,
        habitacionesDisponibles: disponibles,
        totalHabitaciones,
      });
    }
  }

  return resultados;
}

// Verifica que una habitación física específica esté libre en el rango de
// fechas dado (sin otra reserva activa asignada ni bloqueo). excludeReservaId
// permite re-asignar la misma reserva a otra habitación sin que choque con
// su propia asignación anterior.
export async function verificarHabitacionLibre(
  habitacionId: string,
  fechaIngreso: Date,
  fechaSalida: Date,
  excludeReservaId?: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
  const estadosOcupados: EstadoReserva[] = [EstadoReserva.CONFIRMADA, EstadoReserva.EN_CURSO];

  const reservaSolapada = await client.reserva.findFirst({
    where: {
      asignacion: { habitacionId },
      estado: { in: estadosOcupados },
      fechaIngreso: { lt: fechaSalida },
      fechaSalida: { gt: fechaIngreso },
      ...(excludeReservaId ? { id: { not: excludeReservaId } } : {}),
    },
  });
  if (reservaSolapada) return false;

  const bloqueoSolapado = await client.bloqueoDeHabitacion.findFirst({
    where: {
      habitacionId,
      fechaInicio: { lt: fechaSalida },
      fechaFin: { gt: fechaIngreso },
    },
  });
  return !bloqueoSolapado;
}

export async function verificarDisponibilidadAtómica(
  tipoDeHabitacionId: string,
  fechaIngreso: Date,
  fechaSalida: Date
): Promise<boolean> {
  const disponibles = await calcularDisponibilidad(
    tipoDeHabitacionId,
    fechaIngreso,
    fechaSalida
  );
  return disponibles > 0;
}
