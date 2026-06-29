import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarRecordatorio } from "@/lib/emails";

// Invocado por Vercel Cron diariamente. Guarda en CRON_SECRET para verificar.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Reservas con check-in en las próximas 48h (entre 24h y 48h desde ahora)
  const ahora = new Date();
  const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);
  const en48h = new Date(ahora.getTime() + 48 * 60 * 60 * 1000);

  const reservas = await prisma.reserva.findMany({
    where: {
      estado: "CONFIRMADA",
      fechaIngreso: { gte: en24h, lte: en48h },
    },
    include: {
      huesped: true,
      tipoDeHabitacion: true,
      propiedad: true,
    },
  });

  const resultados = await Promise.allSettled(
    reservas.map((r) =>
      enviarRecordatorio({
        emailHuesped: r.huesped.email,
        codigoReserva: r.codigoReserva,
        nombreHuesped: r.huesped.nombre,
        nombreHotel: r.propiedad.nombre,
        tipoHabitacion: r.tipoDeHabitacion.nombre,
        fechaIngreso: r.fechaIngreso,
        fechaSalida: r.fechaSalida,
        numPersonas: r.numPersonas,
        direccion: r.propiedad.direccion ?? undefined,
        telefono: r.propiedad.telefono ?? undefined,
        colorPrimario: r.propiedad.colorPrimario ?? undefined,
      })
    )
  );

  const enviados = resultados.filter((r) => r.status === "fulfilled").length;
  const fallidos = resultados.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ enviados, fallidos, total: reservas.length });
}
