import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarRespuestaCambioHotel } from "@/lib/emails";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const expiradas = await prisma.solicitudCambio.findMany({
    where: {
      estado: "PENDIENTE",
      expiresAt: { lt: new Date() },
    },
    include: {
      reserva: { include: { propiedad: true, huesped: true } },
    },
  });

  await prisma.solicitudCambio.updateMany({
    where: { id: { in: expiradas.map((s) => s.id) } },
    data: { estado: "EXPIRADA" },
  });

  for (const solicitud of expiradas) {
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
        respuesta: "EXPIRADA",
        colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
      }).catch(() => {});
    }
  }

  // Expirar reservas PENDIENTE_PAGO con link vencido
  const reservasExpiradas = await prisma.reserva.findMany({
    where: {
      estado: "PENDIENTE_PAGO",
      linkExpiraEn: { lt: new Date() },
    },
  });

  if (reservasExpiradas.length > 0) {
    await prisma.reserva.updateMany({
      where: { id: { in: reservasExpiradas.map((r) => r.id) } },
      data: { estado: "CANCELADA" },
    });
  }

  return NextResponse.json({ procesadas: expiradas.length, pagosExpirados: reservasExpiradas.length });
}
