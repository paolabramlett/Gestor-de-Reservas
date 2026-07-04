import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { prisma } from "@/lib/prisma";
import { completarRegistroCheckIn } from "@/lib/negocio/cicloDeVida";

const ERROR_GENERICO = { error: "No encontramos una reserva con esos datos" };

export async function POST(req: NextRequest) {
  if (!rateLimit(req, { limite: 20, ventanaMs: 60_000 })) {
    return NextResponse.json({ error: "Demasiadas solicitudes, intenta de nuevo en un minuto" }, { status: 429 });
  }

  const body = await req.json();
  const codigoNorm = (body.codigo as string)?.trim().toUpperCase();
  const emailNorm = (body.email as string)?.trim().toLowerCase();

  if (!codigoNorm || !emailNorm) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  let reserva;
  if (codigoNorm.startsWith("GRP-")) {
    const grupo = await prisma.grupoReserva.findFirst({
      where: { codigoGrupo: codigoNorm },
      include: { reservas: { include: { huesped: true } } },
    });
    reserva = grupo?.reservas.find((r) => r.huesped.email.toLowerCase() === emailNorm) ?? null;
  } else {
    reserva = await prisma.reserva.findFirst({
      where: { codigoReserva: codigoNorm, huesped: { email: emailNorm } },
    });
  }

  if (!reserva) {
    return NextResponse.json(ERROR_GENERICO, { status: 404 });
  }

  try {
    await completarRegistroCheckIn(reserva.id, reserva.propiedadId, {
      documentoTipo: body.documentoTipo || null,
      documentoNumero: body.documentoNumero || null,
      nacionalidad: body.nacionalidad || null,
      placasVehiculo: body.placasVehiculo || null,
      politicasAceptadas: !!body.politicasAceptadas,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo guardar tu registro";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
