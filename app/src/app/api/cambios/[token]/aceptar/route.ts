import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { enviarRespuestaCambioHotel, enviarCambioAceptadoHuesped } from "@/lib/emails";
import { verificarDisponibilidadAtómica } from "@/lib/negocio/disponibilidad";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const solicitud = await prisma.solicitudCambio.findUnique({
    where: { token },
    include: {
      reserva: {
        include: { huesped: true, propiedad: true },
      },
    },
  });

  if (!solicitud) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  if (solicitud.estado !== "PENDIENTE") {
    return NextResponse.json({ error: "Esta propuesta ya no está activa", estado: solicitud.estado }, { status: 400 });
  }
  if (new Date() > solicitud.expiresAt) {
    await prisma.solicitudCambio.update({ where: { id: solicitud.id }, data: { estado: "EXPIRADA" } });
    return NextResponse.json({ error: "La propuesta ha expirado", estado: "EXPIRADA" }, { status: 400 });
  }

  const { reserva } = solicitud;
  const diferencia = Number(solicitud.diferencia);
  const esCobro = diferencia > 0;

  // Re-verificar disponibilidad antes de aceptar (puede haber cambiado desde que se propuso)
  const disponible = await verificarDisponibilidadAtómica(
    reserva.tipoDeHabitacionId,
    solicitud.fechaIngresoNueva,
    solicitud.fechaSalidaNueva
  );
  if (!disponible) {
    await prisma.solicitudCambio.update({ where: { id: solicitud.id }, data: { estado: "CANCELADA" } });
    return NextResponse.json({
      error: "Lo sentimos, ya no hay disponibilidad para esas fechas. La propuesta ha sido cancelada.",
      estado: "CANCELADA",
    }, { status: 409 });
  }

  // Procesar reembolso automático si aplica.
  // Cobros adicionales NO se procesan automáticamente (requieren método de pago guardado).
  // En su lugar, se notifica al hotel para cobro manual.
  if (!esCobro && reserva.stripePaymentIntentId && Math.abs(diferencia) > 0) {
    try {
      // Verificar que no se haya reembolsado ya más de lo disponible
      const refundsExistentes = await stripe.refunds.list({ payment_intent: reserva.stripePaymentIntentId });
      const totalReembolsado = refundsExistentes.data
        .filter((r) => r.status === "succeeded")
        .reduce((sum, r) => sum + r.amount, 0);
      const totalOriginalCentavos = Math.round(Number(reserva.totalMxn) * 100);
      const disponibleParaReembolso = totalOriginalCentavos - totalReembolsado;
      const montoCentavos = Math.min(
        Math.round(Math.abs(diferencia) * 100),
        disponibleParaReembolso
      );

      if (montoCentavos > 0) {
        await stripe.refunds.create({
          payment_intent: reserva.stripePaymentIntentId,
          amount: montoCentavos,
        });
      }
    } catch (err) {
      // Reembolso fallido: actualizar solicitud y notificar hotel manualmente
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error("[cambio/aceptar] Refund failed:", msg);
      // No bloqueamos la aceptación; el hotel debe procesar el reembolso manualmente
    }
  }

  // Actualizar solicitud y reserva en una sola transacción
  try {
    await prisma.$transaction([
      prisma.solicitudCambio.update({ where: { id: solicitud.id }, data: { estado: "ACEPTADA" } }),
      prisma.reserva.update({
        where: { id: reserva.id },
        data: {
          fechaIngreso: solicitud.fechaIngresoNueva,
          fechaSalida: solicitud.fechaSalidaNueva,
          totalMxn: solicitud.totalNuevo,
        },
      }),
    ]);
  } catch (err) {
    // Si el reembolso ya se procesó pero el DB falló, intentar revertir el reembolso
    // En este sistema simplificado, loggeamos para revisión manual
    console.error("[cambio/aceptar] DB transaction failed after Stripe operation:", err);
    return NextResponse.json({ error: "Error al actualizar la reserva. Contacta al hotel." }, { status: 500 });
  }

  // Notificar al huésped y al hotel (fire-and-forget)
  enviarCambioAceptadoHuesped({
    emailHuesped: reserva.huesped.email,
    codigoReserva: reserva.codigoReserva,
    nombreHuesped: reserva.nombreHuesped || reserva.huesped.nombre,
    nombreHotel: reserva.propiedad.nombre,
    fechaIngresoNueva: solicitud.fechaIngresoNueva,
    fechaSalidaNueva: solicitud.fechaSalidaNueva,
    totalNuevo: Number(solicitud.totalNuevo),
    diferencia,
    esCobro,
    cobroManual: esCobro,
    colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
  }).catch(() => {});

  if (reserva.propiedad.email) {
    enviarRespuestaCambioHotel({
      emailHotel: reserva.propiedad.email,
      codigoReserva: reserva.codigoReserva,
      nombreHuesped: reserva.nombreHuesped || reserva.huesped.nombre,
      nombreHotel: reserva.propiedad.nombre,
      fechaIngresoNueva: solicitud.fechaIngresoNueva,
      fechaSalidaNueva: solicitud.fechaSalidaNueva,
      totalNuevo: Number(solicitud.totalNuevo),
      diferencia,
      esCobro,
      respuesta: "ACEPTADA",
      colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, estado: "ACEPTADA", cobroManualRequerido: esCobro });
}
