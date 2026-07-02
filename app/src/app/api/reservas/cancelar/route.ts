import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { enviarCancelacion } from "@/lib/emails";

const STRIPE_COMISION_PORCENTAJE = 0.036;
const STRIPE_COMISION_FIJA = 3;
const ERROR_GENERICO = { error: "No encontramos una reserva con esos datos" };

export async function POST(req: NextRequest) {
  const { codigo, email } = await req.json();

  if (!codigo || !email) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  const reserva = await prisma.reserva.findFirst({
    where: {
      codigoReserva: codigo,
      huesped: { email: email.toLowerCase() },
    },
  });

  if (!reserva) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  // Validar cancelación
  if (reserva.estado !== "CONFIRMADA") {
    return NextResponse.json({ error: "Esta reserva no puede cancelarse" }, { status: 400 });
  }

  if (reserva.origen !== "ONLINE") {
    return NextResponse.json(
      { error: "Contacta al hotel para cancelar esta reserva" },
      { status: 400 }
    );
  }

  const ahora = new Date();
  const horas48AntesChekin = new Date(reserva.fechaIngreso);
  horas48AntesChekin.setHours(horas48AntesChekin.getHours() - 48);

  if (ahora >= horas48AntesChekin) {
    return NextResponse.json(
      { error: "La ventana de cancelación ha cerrado (48h antes del check-in)" },
      { status: 400 }
    );
  }

  // Calcular reembolso parcial
  const total = Number(reserva.totalMxn);
  const comision = Math.round((total * STRIPE_COMISION_PORCENTAJE + STRIPE_COMISION_FIJA) * 100) / 100;
  const montoReembolso = total - comision;

  // Reembolso parcial via Stripe
  if (reserva.stripePaymentIntentId) {
    await stripe.refunds.create({
      payment_intent: reserva.stripePaymentIntentId,
      amount: Math.round(montoReembolso * 100), // centavos
    });
  }

  // Actualizar estado y obtener datos para el correo
  const reservaActualizada = await prisma.reserva.update({
    where: { id: reserva.id },
    data: { estado: "CANCELADA" },
    include: {
      huesped: true,
      propiedad: true,
    },
  });

  // Enviar correo de confirmación de cancelación
  try {
    await enviarCancelacion({
      emailHuesped: reservaActualizada.huesped.email,
      codigoReserva: reservaActualizada.codigoReserva,
      nombreHuesped: reservaActualizada.nombreHuesped || reservaActualizada.huesped.nombre,
      nombreHotel: reservaActualizada.propiedad.nombre,
      fechaIngreso: reservaActualizada.fechaIngreso,
      fechaSalida: reservaActualizada.fechaSalida,
      totalMxn: Number(reservaActualizada.totalMxn),
      montoReembolsadoMxn: reserva.stripePaymentIntentId ? montoReembolso : undefined,
      colorPrimario: reservaActualizada.propiedad.colorPrimario ?? undefined,
    });
  } catch {
    // El correo falla silenciosamente — la cancelación ya fue procesada
  }

  return NextResponse.json({ cancelada: true, montoReembolso, comisionRetenida: comision });
}
