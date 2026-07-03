import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const STRIPE_COMISION_PORCENTAJE = 0.036;
const STRIPE_COMISION_FIJA = 3;
const ERROR_GENERICO = { error: "No encontramos una reserva con esos datos" };

export async function GET(req: NextRequest) {
  const codigo = req.nextUrl.searchParams.get("codigo")?.trim().toUpperCase();
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!codigo || !email) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  // ── Reserva de grupo (GRP-XXXX-XXXX) ─────────────────────────────────────
  if (codigo.startsWith("GRP-")) {
    const grupo = await prisma.grupoReserva.findFirst({
      where: { codigoGrupo: codigo },
      select: {
        codigoGrupo: true,
        stripePaymentIntentId: true,
        reservas: {
          where: { estado: { notIn: ["CANCELADA", "NO_SHOW"] } },
          select: {
            estado: true,
            fechaIngreso: true,
            fechaSalida: true,
            numPersonas: true,
            totalMxn: true,
            huesped: { select: { nombre: true, email: true } },
            tipoDeHabitacion: { select: { nombre: true } },
          },
          orderBy: { fechaIngreso: "asc" },
        },
      },
    });

    if (!grupo || grupo.reservas.length === 0) {
      return NextResponse.json(ERROR_GENERICO, { status: 404 });
    }

    const emailMatch = grupo.reservas.some((r) => r.huesped.email.toLowerCase() === email);
    if (!emailMatch) {
      return NextResponse.json(ERROR_GENERICO, { status: 404 });
    }

    const fechaIngreso = grupo.reservas.reduce(
      (min, r) => (r.fechaIngreso < min ? r.fechaIngreso : min),
      grupo.reservas[0].fechaIngreso
    );
    const fechaSalida = grupo.reservas.reduce(
      (max, r) => (r.fechaSalida > max ? r.fechaSalida : max),
      grupo.reservas[0].fechaSalida
    );
    const totalMxn = grupo.reservas.reduce((s, r) => s + Number(r.totalMxn), 0);

    const ahoraGrupo = new Date();
    const limiteGrupo = new Date(fechaIngreso);
    limiteGrupo.setHours(limiteGrupo.getHours() - 48);
    const grupoConfirmado = grupo.reservas.every((r) => r.estado === "CONFIRMADA");
    const cancelableGrupo = grupoConfirmado && !!grupo.stripePaymentIntentId && ahoraGrupo < limiteGrupo;
    const comisionGrupo = cancelableGrupo
      ? Math.round((totalMxn * STRIPE_COMISION_PORCENTAJE + STRIPE_COMISION_FIJA) * 100) / 100
      : 0;

    return NextResponse.json({
      codigoReserva: grupo.codigoGrupo,
      estado: grupoConfirmado ? "CONFIRMADA" : grupo.reservas[0].estado,
      fechaIngreso: fechaIngreso.toISOString(),
      fechaSalida: fechaSalida.toISOString(),
      totalMxn,
      tipoDeHabitacion: { nombre: `${grupo.reservas.length} habitación${grupo.reservas.length !== 1 ? "es" : ""}` },
      huesped: grupo.reservas[0].huesped,
      origen: "ONLINE",
      cancelable: cancelableGrupo,
      montoReembolso: cancelableGrupo ? totalMxn - comisionGrupo : 0,
      comisionRetenida: comisionGrupo,
      habitaciones: grupo.reservas.map((r) => ({
        tipoNombre: r.tipoDeHabitacion.nombre,
        fechaIngreso: r.fechaIngreso.toISOString(),
        fechaSalida: r.fechaSalida.toISOString(),
        numPersonas: r.numPersonas,
        totalMxn: Number(r.totalMxn),
      })),
    });
  }

  // ── Reserva individual (RES-XXXX-XXXX) ───────────────────────────────────
  const reserva = await prisma.reserva.findFirst({
    where: {
      codigoReserva: codigo,
      huesped: { email },
    },
    include: {
      huesped: { select: { nombre: true, email: true } },
      tipoDeHabitacion: { select: { nombre: true } },
    },
  });

  if (!reserva) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

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
