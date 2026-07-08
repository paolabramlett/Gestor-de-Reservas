import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { reembolsarPagoHuesped } from "@/lib/stripeConnect";
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

export type RegistroCheckInInput = {
  documentoTipo?: string | null;
  documentoNumero?: string | null;
  nacionalidad?: string | null;
  placasVehiculo?: string | null;
  politicasAceptadas: boolean;
};

// Guarda los datos de registro del huésped (documento, nacionalidad, placas y
// aceptación de políticas). No cambia el estado de la reserva — se puede
// llamar desde recepción al hacer check-in, o desde el link público de
// pre-check-in antes de que el huésped llegue.
export async function completarRegistroCheckIn(
  reservaId: string,
  propiedadId: string,
  data: RegistroCheckInInput
) {
  const reserva = await prisma.reserva.findFirst({ where: { id: reservaId, propiedadId } });
  if (!reserva) throw new Error("Reserva no encontrada");
  if (reserva.estado !== EstadoReserva.CONFIRMADA && reserva.estado !== EstadoReserva.EN_CURSO) {
    throw new Error(`No se puede registrar al huésped desde estado ${reserva.estado}`);
  }
  if (!data.politicasAceptadas) {
    throw new Error("Debes confirmar que el huésped presentó identificación y aceptó las políticas del hotel");
  }

  return prisma.reserva.update({
    where: { id: reservaId },
    data: {
      documentoTipo: data.documentoTipo || null,
      documentoNumero: data.documentoNumero || null,
      nacionalidad: data.nacionalidad || null,
      placasVehiculo: data.placasVehiculo || null,
      politicasAceptadas: true,
      politicasAceptadasEn: reserva.politicasAceptadasEn ?? new Date(),
      registroCheckInEn: new Date(),
    },
  });
}

export async function checkIn(reservaId: string, propiedadId: string) {
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId },
    include: { asignacion: true, pagoManual: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");
  if (reserva.estado !== EstadoReserva.CONFIRMADA)
    throw new Error(`No se puede hacer check-in desde estado ${reserva.estado}`);
  if (!reserva.asignacion)
    throw new Error("REQUIERE_ASIGNACION");

  // Reservas manuales (pagoManual existe) no pueden hacer check-in con saldo
  // pendiente. Las reservas online ya están pagadas al 100% desde el booking
  // (sin pagoManual), así que no aplica esta validación.
  if (reserva.pagoManual && reserva.pagoManual.estadoDePago !== "PAGADO_COMPLETO") {
    const anticipo = Number(reserva.pagoManual.montoAnticipo ?? 0);
    const saldoPendiente = Number(reserva.totalMxn) - anticipo;
    if (saldoPendiente > 0) {
      throw new Error(
        `La reserva tiene un saldo pendiente de $${saldoPendiente.toLocaleString("es-MX")} MXN. Registra el pago antes de hacer check-in.`
      );
    }
  }

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

  // Claim atómico ANTES de tocar Stripe: si dos requests llegan casi al
  // mismo tiempo (doble clic, doble pestaña), solo la primera logra marcar
  // CANCELADA — la segunda ve count 0 y nunca llega a pedir el reembolso.
  const claim = await prisma.reserva.updateMany({
    where: { id: input.reservaId, propiedadId: input.propiedadId, estado: reserva.estado },
    data: { estado: EstadoReserva.CANCELADA },
  });
  if (claim.count === 0) {
    throw new Error("Esta reserva ya fue cancelada por otra solicitud");
  }

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
        await reembolsarPagoHuesped(reserva.stripePaymentIntentId, montoFinal);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al procesar reembolso";
        throw new Error(`Reembolso fallido: ${msg}`);
      }
    }
  }

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

  return { ...reserva, estado: EstadoReserva.CANCELADA };
}
