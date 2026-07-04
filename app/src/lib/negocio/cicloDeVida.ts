import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { enviarCancelacion } from "@/lib/emails";
import { EstadoReserva } from "@prisma/client";

// Una reserva solo se puede borrar (hard delete) si no hay dinero real de por
// medio: sin pago por Stripe capturado y sin anticipo/pago manual registrado.
// Si pertenece a un grupo, el grupo tampoco debe tener nada pagado — de lo
// contrario se debe usar "Cancelar" para conservar el historial de pago.
export function tieneEliminacionSegura(reserva: {
  stripePaymentIntentId: string | null;
  pagoManual: { estadoDePago: string } | null;
  grupo: { totalPagado: unknown } | null;
}): boolean {
  if (reserva.stripePaymentIntentId) return false;
  if (reserva.pagoManual && reserva.pagoManual.estadoDePago !== "PENDIENTE") return false;
  if (reserva.grupo && Number(reserva.grupo.totalPagado) > 0) return false;
  return true;
}

export async function eliminarReserva(reservaId: string, propiedadId: string) {
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId },
    include: { pagoManual: true, grupo: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");
  if (!tieneEliminacionSegura(reserva)) {
    throw new Error("No se puede eliminar: tiene un pago confirmado. Usa Cancelar en su lugar.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.asignacionDeHabitacion.deleteMany({ where: { reservaId } });
    await tx.solicitudCambio.deleteMany({ where: { reservaId } });
    if (reserva.pagoManual) await tx.pagoManual.deleteMany({ where: { reservaId } });
    await tx.reserva.delete({ where: { id: reservaId } });

    // Si era la última reserva activa de su grupo y el grupo no tiene nada
    // pagado, el grupo queda vacío y sin propósito — se borra también.
    if (reserva.grupoId) {
      const restantes = await tx.reserva.count({ where: { grupoId: reserva.grupoId } });
      if (restantes === 0) {
        await tx.grupoReserva.delete({ where: { id: reserva.grupoId } });
      }
    }
  });
}

export async function checkIn(reservaId: string, propiedadId: string) {
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId },
    include: { asignacion: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");
  if (reserva.estado !== EstadoReserva.CONFIRMADA)
    throw new Error(`No se puede hacer check-in desde estado ${reserva.estado}`);
  if (!reserva.asignacion)
    throw new Error("REQUIERE_ASIGNACION");

  return prisma.reserva.update({
    where: { id: reservaId },
    data: { estado: EstadoReserva.EN_CURSO },
  });
}

export async function checkOut(reservaId: string, propiedadId: string) {
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId },
  });
  if (!reserva) throw new Error("Reserva no encontrada");
  if (reserva.estado !== EstadoReserva.EN_CURSO)
    throw new Error(`No se puede hacer check-out desde estado ${reserva.estado}`);

  return prisma.reserva.update({
    where: { id: reservaId },
    data: { estado: EstadoReserva.COMPLETADA },
  });
}

export async function marcarNoShow(reservaId: string, propiedadId: string) {
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId },
  });
  if (!reserva) throw new Error("Reserva no encontrada");
  if (reserva.estado !== EstadoReserva.CONFIRMADA)
    throw new Error(`No se puede marcar No-Show desde estado ${reserva.estado}`);

  return prisma.reserva.update({
    where: { id: reservaId },
    data: { estado: EstadoReserva.NO_SHOW },
  });
}

type CancelacionInput = {
  reservaId: string;
  propiedadId: string;
  politicaReembolso: "TOTAL" | "PARCIAL" | "SIN_REEMBOLSO";
  montoParcialMxn?: number;
};

export async function cancelarReserva(input: CancelacionInput) {
  const reserva = await prisma.reserva.findFirst({
    where: { id: input.reservaId, propiedadId: input.propiedadId },
    include: { huesped: true, tipoDeHabitacion: true, propiedad: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");
  if (reserva.estado === EstadoReserva.COMPLETADA || reserva.estado === EstadoReserva.CANCELADA)
    throw new Error(`No se puede cancelar una reserva en estado ${reserva.estado}`);

  let montoReembolsadoMxn = 0;

  // Reembolso Stripe si aplica
  if (reserva.stripePaymentIntentId && input.politicaReembolso !== "SIN_REEMBOLSO") {
    const montoTotal = Number(reserva.totalMxn);
    const monto = input.politicaReembolso === "TOTAL" ? montoTotal : (input.montoParcialMxn ?? 0);

    // Validar monto: debe ser positivo y no superar el total
    if (monto < 0) throw new Error("El monto de reembolso no puede ser negativo");
    if (monto > montoTotal) throw new Error("El monto de reembolso no puede superar el total de la reserva");

    montoReembolsadoMxn = monto;
    const montoCentavos = Math.round(montoReembolsadoMxn * 100);

    if (montoCentavos > 0) {
      // Verificar que no haya un reembolso ya emitido por el monto completo
      const refundsExistentes = await stripe.refunds.list({ payment_intent: reserva.stripePaymentIntentId });
      const totalReembolsado = refundsExistentes.data
        .filter((r) => r.status === "succeeded")
        .reduce((sum, r) => sum + r.amount, 0);
      const disponibleParaReembolso = Math.round(montoTotal * 100) - totalReembolsado;

      if (disponibleParaReembolso <= 0) {
        throw new Error("Esta reserva ya fue reembolsada completamente");
      }
      const montoFinal = Math.min(montoCentavos, disponibleParaReembolso);

      try {
        await stripe.refunds.create({
          payment_intent: reserva.stripePaymentIntentId,
          amount: montoFinal,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al procesar reembolso";
        throw new Error(`Reembolso fallido: ${msg}`);
      }
    }
  }

  const cancelada = await prisma.reserva.update({
    where: { id: input.reservaId },
    data: { estado: EstadoReserva.CANCELADA },
  });

  // 11.6: email de cancelación al huésped
  await enviarCancelacion({
    emailHuesped: reserva.huesped.email,
    codigoReserva: reserva.codigoReserva,
    nombreHuesped: reserva.nombreHuesped || reserva.huesped.nombre,
    nombreHotel: reserva.propiedad.nombre,
    fechaIngreso: reserva.fechaIngreso,
    fechaSalida: reserva.fechaSalida,
    totalMxn: Number(reserva.totalMxn),
    montoReembolsadoMxn: montoReembolsadoMxn > 0 ? montoReembolsadoMxn : undefined,
    colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
  }).catch(() => {});

  return cancelada;
}
