import { prisma } from "@/lib/prisma";
import { EstadoReserva, Prisma } from "@prisma/client";
import { picoOcupacionPorNoche } from "./ocupacion";

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

  const totalHabitaciones = tipo.habitaciones.length;
  if (totalHabitaciones === 0) return 0;
  const habitacionIds = tipo.habitaciones.map((h) => h.id);

  // Cierre del tipo completo (temporada cerrada, sync iCal) → nada disponible.
  // Antes solo se verificaba en buscarDisponibilidad; los checkouts que llaman
  // esta función directo podían reservar un tipo cerrado.
  const bloqueoTipo = await prisma.bloqueoDetipo.findFirst({
    where: {
      tipoDeHabitacionId,
      fechaInicio: { lte: fechaSalida },
      fechaFin: { gte: fechaIngreso },
    },
  });
  if (bloqueoTipo) return 0;

  const [reservas, bloqueos] = await Promise.all([
    prisma.reserva.findMany({
      where: {
        tipoDeHabitacionId,
        fechaIngreso: { lt: fechaSalida },
        fechaSalida: { gt: fechaIngreso },
        OR: [
          { estado: { in: [EstadoReserva.CONFIRMADA, EstadoReserva.EN_CURSO] } },
          // Un link de pago vigente aparta el cuarto hasta expirar — si no
          // contara, dos huéspedes podrían pagar el mismo último cuarto.
          { estado: EstadoReserva.PENDIENTE_PAGO, linkExpiraEn: { gt: new Date() } },
        ],
      },
      select: {
        fechaIngreso: true,
        fechaSalida: true,
        asignacion: { select: { habitacionId: true } },
      },
    }),
    prisma.bloqueoDeHabitacion.findMany({
      where: {
        habitacionId: { in: habitacionIds },
        fechaInicio: { lt: fechaSalida },
        fechaFin: { gt: fechaIngreso },
      },
      select: { habitacionId: true, fechaInicio: true, fechaFin: true },
    }),
  ]);

  // Las reservas SIN habitación asignada también consumen inventario del
  // tipo — antes solo contaban las asignadas, así que una reserva online
  // recién creada no bloqueaba nada y se podía sobrevender.
  const pico = picoOcupacionPorNoche(
    fechaIngreso,
    fechaSalida,
    reservas.map((r) => ({
      fechaIngreso: r.fechaIngreso,
      fechaSalida: r.fechaSalida,
      habitacionAsignadaId: r.asignacion?.habitacionId ?? null,
    })),
    bloqueos
  );

  return totalHabitaciones - pico;
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
  const reservaSolapada = await client.reserva.findFirst({
    where: {
      asignacion: { habitacionId },
      OR: [
        { estado: { in: [EstadoReserva.CONFIRMADA, EstadoReserva.EN_CURSO] } },
        // Un link de pago vigente también aparta la habitación
        { estado: EstadoReserva.PENDIENTE_PAGO, linkExpiraEn: { gt: new Date() } },
      ],
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
