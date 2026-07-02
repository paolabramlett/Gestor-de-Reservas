import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUsuario } from "@/lib/auth";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { verificarDisponibilidadAtómica } from "@/lib/negocio/disponibilidad";
import { enviarPropuestaCambio } from "@/lib/emails";

const STRIPE_COMISION_PORCENTAJE = 0.036;
const STRIPE_COMISION_FIJA = 3;
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://app-nu-ruddy-98.vercel.app";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await getCurrentUsuario();
  if (!usuario) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { fechaIngresoNueva, fechaSalidaNueva } = body;

  if (!fechaIngresoNueva || !fechaSalidaNueva) {
    return NextResponse.json({ error: "Fechas requeridas" }, { status: 400 });
  }

  const ingreso = new Date(fechaIngresoNueva + "T12:00:00");
  const salida = new Date(fechaSalidaNueva + "T12:00:00");

  if (isNaN(ingreso.getTime()) || isNaN(salida.getTime())) {
    return NextResponse.json({ error: "Fechas inválidas" }, { status: 400 });
  }
  if (salida <= ingreso) {
    return NextResponse.json({ error: "La fecha de salida debe ser posterior a la de llegada" }, { status: 400 });
  }
  if (ingreso < new Date()) {
    return NextResponse.json({ error: "La fecha de llegada no puede ser en el pasado" }, { status: 400 });
  }

  const reserva = await prisma.reserva.findFirst({
    where: { id, propiedadId: usuario.propiedadId, estado: "CONFIRMADA" },
    include: { huesped: true, propiedad: true },
  });

  if (!reserva) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  if (reserva.origen !== "ONLINE") {
    return NextResponse.json({ error: "Solo se pueden proponer cambios en reservas online" }, { status: 400 });
  }

  // Verificar disponibilidad para las nuevas fechas
  const disponible = await verificarDisponibilidadAtómica(reserva.tipoDeHabitacionId, ingreso, salida);
  if (!disponible) {
    return NextResponse.json({ error: "No hay disponibilidad para las fechas seleccionadas" }, { status: 409 });
  }

  // Cancelar propuestas pendientes anteriores
  await prisma.solicitudCambio.updateMany({
    where: { reservaId: id, estado: "PENDIENTE" },
    data: { estado: "CANCELADA" },
  });

  const { total: totalNuevoRaw } = await calcularTotalReserva(
    reserva.tipoDeHabitacionId,
    ingreso,
    salida,
    reserva.numPersonas
  );

  const totalActual = Number(reserva.totalMxn);
  const totalNuevo = Number(totalNuevoRaw);
  const diff = totalNuevo - totalActual;
  const esCobro = diff > 0;
  const comision = Math.round((Math.abs(diff) * STRIPE_COMISION_PORCENTAJE + STRIPE_COMISION_FIJA) * 100) / 100;
  const diferenciaNeta = esCobro ? diff + comision : diff - comision;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const solicitud = await prisma.solicitudCambio.create({
    data: {
      reservaId: id,
      fechaIngresoNueva: ingreso,
      fechaSalidaNueva: salida,
      totalActual,
      totalNuevo,
      diferencia: diferenciaNeta,
      expiresAt,
    },
  });

  // Enviar correo (fire-and-forget — no bloqueamos la respuesta)
  enviarPropuestaCambio({
    emailHuesped: reserva.huesped.email,
    codigoReserva: reserva.codigoReserva,
    nombreHuesped: reserva.nombreHuesped || reserva.huesped.nombre,
    nombreHotel: reserva.propiedad.nombre,
    fechaIngresoActual: reserva.fechaIngreso,
    fechaSalidaActual: reserva.fechaSalida,
    fechaIngresoNueva: ingreso,
    fechaSalidaNueva: salida,
    totalActual,
    totalNuevo,
    diferencia: diferenciaNeta,
    esCobro,
    urlAceptar: `${BASE_URL}/cambio/${solicitud.token}`,
    urlRechazar: `${BASE_URL}/cambio/${solicitud.token}?accion=rechazar`,
    expiresAt,
    colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
  }).catch((err) => console.error("[proponer-cambio] Email failed:", err));

  return NextResponse.json({ ok: true, solicitudId: solicitud.id });
}
