import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPropiedad } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const propiedad = await getCurrentPropiedad();
  if (!propiedad) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { tipoDeHabitacionId, nombre, url } = await req.json();
  if (!tipoDeHabitacionId || !nombre || !url) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: tipoDeHabitacionId, propiedadId: propiedad.id },
  });
  if (!tipo) return NextResponse.json({ error: "Tipo no encontrado" }, { status: 404 });

  const feed = await prisma.icalFeed.create({
    data: { propiedadId: propiedad.id, tipoDeHabitacionId, nombre, url },
  });

  return NextResponse.json(feed, { status: 201 });
}
