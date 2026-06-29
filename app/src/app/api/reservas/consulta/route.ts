import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STRIPE_COMISION_PORCENTAJE = 0.036; // 3.6%
const STRIPE_COMISION_FIJA = 3; // $3 MXN

const ERROR_GENERICO = { error: "No encontramos una reserva con esos datos" };

export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get("codigo");
  const email = req.nextUrl.searchParams.get("email");

  if (!codigo || !email) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  const reserva = await prisma.reserva.findFirst({
    where: {
      codigoReserva: codigo,
      huesped: { email: email.toLowerCase() },
    },
    include: {
      huesped: { select: { nombre: true, email: true } },
      tipoDeHabitacion: { select: { nombre: true } },
    },
  });

  if (!reserva) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  // Verificar si es cancelable: CONFIRMADA + más de 48h antes del check-in + PagoOnline
  const ahora = new Date();
  const horas48AntesChekin = new Date(reserva.fechaIngreso);
  horas48AntesChekin.setHours(horas48AntesChekin.getHours() - 48);
  const cancelable =
    reserva.estado === "CONFIRMADA" &&
    reserva.origen === "ONLINE" &&
    ahora < horas48AntesChekin;

  const total = Number(reserva.totalMxn);
  const comisionRetenida = cancelable
    ? Math.round((total * STRIPE_COMISION_PORCENTAJE + STRIPE_COMISION_FIJA) * 100) / 100
    : 0;
  const montoReembolso = cancelable ? total - comisionRetenida : 0;

  return NextResponse.json({
    codigoReserva: reserva.codigoReserva,
    estado: reserva.estado,
    fechaIngreso: reserva.fechaIngreso.toISOString(),
    fechaSalida: reserva.fechaSalida.toISOString(),
    totalMxn: total,
    tipoDeHabitacion: reserva.tipoDeHabitacion,
    huesped: reserva.huesped,
    origen: reserva.origen,
    cancelable,
    montoReembolso,
    comisionRetenida,
  });
}
