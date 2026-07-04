import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { EstadoReserva } from "@prisma/client";

const ERROR_GENERICO = { error: "No encontramos una reserva con esos datos" };

export async function POST(req: NextRequest) {
  if (!rateLimit(req, { limite: 20, ventanaMs: 60_000 })) {
    return NextResponse.json({ error: "Demasiadas solicitudes, intenta de nuevo en un minuto" }, { status: 429 });
  }

  const { codigo, email } = await req.json();
  const codigoNorm = (codigo as string)?.trim().toUpperCase();
  const emailNorm = (email as string)?.trim().toLowerCase();

  if (!codigoNorm || !emailNorm) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  let reserva;
  if (codigoNorm.startsWith("GRP-")) {
    const grupo = await prisma.grupoReserva.findFirst({
      where: { codigoGrupo: codigoNorm },
      include: { reservas: { include: { huesped: true, tipoDeHabitacion: true, propiedad: true } } },
    });
    reserva = grupo?.reservas.find((r) => r.huesped.email.toLowerCase() === emailNorm) ?? null;
  } else {
    reserva = await prisma.reserva.findFirst({
      where: { codigoReserva: codigoNorm, huesped: { email: emailNorm } },
      include: { huesped: true, tipoDeHabitacion: true, propiedad: true },
    });
  }

  if (!reserva) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  if (reserva.estado !== EstadoReserva.CONFIRMADA && reserva.estado !== EstadoReserva.EN_CURSO) {
    return NextResponse.json(
      { error: "Esta reserva ya no admite pre-check-in (revisa su estado con el hotel)" },
      { status: 400 }
    );
  }

  return NextResponse.json({
    nombreHotel: reserva.propiedad.nombre,
    nombreHuesped: reserva.nombreHuesped || reserva.huesped.nombre,
    tipoHabitacion: reserva.tipoDeHabitacion.nombre,
    fechaIngreso: reserva.fechaIngreso,
    fechaSalida: reserva.fechaSalida,
    registro: {
      documentoTipo: reserva.documentoTipo,
      documentoNumero: reserva.documentoNumero,
      nacionalidad: reserva.nacionalidad,
      placasVehiculo: reserva.placasVehiculo,
      politicasAceptadas: reserva.politicasAceptadas,
    },
  });
}
