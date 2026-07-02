import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentPropiedad } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const propiedad = await getCurrentPropiedad();
  if (!propiedad) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;

  const feed = await prisma.icalFeed.findFirst({
    where: { id, propiedadId: propiedad.id },
  });
  if (!feed) return NextResponse.json({ error: "Feed no encontrado" }, { status: 404 });

  await prisma.icalFeed.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
