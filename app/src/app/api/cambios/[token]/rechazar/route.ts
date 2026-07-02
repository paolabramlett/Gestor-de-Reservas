import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarRespuestaCambioHotel } from "@/lib/emails";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const solicitud = await prisma.solicitudCambio.findUnique({
    where: { token },
    include: {
      reserva: { include: { huesped: true, propiedad: true } },
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

  await prisma.solicitudCambio.update({ where: { id: solicitud.id }, data: { estado: "RECHAZADA" } });

  const { reserva } = solicitud;
  if (reserva.propiedad.email) {
    await enviarRespuestaCambioHotel({
      emailHotel: reserva.propiedad.email,
      codigoReserva: reserva.codigoReserva,
      nombreHuesped: reserva.nombreHuesped || reserva.huesped.nombre,
      nombreHotel: reserva.propiedad.nombre,
      fechaIngresoNueva: solicitud.fechaIngresoNueva,
      fechaSalidaNueva: solicitud.fechaSalidaNueva,
      totalNuevo: Number(solicitud.totalNuevo),
      diferencia: Number(solicitud.diferencia),
      esCobro: Number(solicitud.diferencia) > 0,
      respuesta: "RECHAZADA",
      colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, estado: "RECHAZADA" });
}
