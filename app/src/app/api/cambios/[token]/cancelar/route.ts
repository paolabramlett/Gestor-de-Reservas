import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUsuario } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const usuario = await getCurrentUsuario();
  if (!usuario) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { token } = await params;

  const solicitud = await prisma.solicitudCambio.findUnique({
    where: { token },
    include: { reserva: true },
  });

  if (!solicitud) return NextResponse.json({ error: "Propuesta no encontrada" }, { status: 404 });
  if (solicitud.reserva.propiedadId !== usuario.propiedadId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (solicitud.estado !== "PENDIENTE") {
    return NextResponse.json({ error: "Solo se pueden cancelar propuestas pendientes" }, { status: 400 });
  }

  await prisma.solicitudCambio.update({ where: { id: solicitud.id }, data: { estado: "CANCELADA" } });

  return NextResponse.json({ ok: true });
}
