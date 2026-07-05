import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { stripe } from "@/lib/stripe";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { verificarDisponibilidadAtómica } from "@/lib/negocio/disponibilidad";
import { getPropiedadBySlug } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  slug: z.string(),
  tipoDeHabitacionId: z.string(),
  nombre: z.string().min(2),
  email: z.string().email(),
  telefono: z.string().optional(),
  fechaIngreso: z.string().date(),
  fechaSalida: z.string().date(),
  numPersonas: z.number().int().min(1),
});

export async function POST(req: NextRequest) {
  if (!rateLimit(req, { limite: 20, ventanaMs: 60_000 })) {
    return NextResponse.json({ error: "Demasiadas solicitudes, intenta de nuevo en un minuto" }, { status: 429 });
  }

  const body = await req.json();
  const result = bodySchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const data = result.data;
  const fechaIn = new Date(data.fechaIngreso);
  const fechaOut = new Date(data.fechaSalida);

  const propiedad = await getPropiedadBySlug(data.slug);
  if (!propiedad) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }
  if (!propiedad.suscripcionActiva) {
    return NextResponse.json({ error: "Este hotel no acepta reservas en línea en este momento" }, { status: 403 });
  }

  const disponible = await verificarDisponibilidadAtómica(
    data.tipoDeHabitacionId,
    fechaIn,
    fechaOut
  );

  if (!disponible) {
    return NextResponse.json({ error: "Sin disponibilidad" }, { status: 409 });
  }

  const { total } = await calcularTotalReserva(
    data.tipoDeHabitacionId,
    fechaIn,
    fechaOut,
    data.numPersonas
  );

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(total * 100), // centavos
    currency: "mxn",
    metadata: {
      propiedadId: propiedad.id,
      tipoDeHabitacionId: data.tipoDeHabitacionId,
      nombre: data.nombre,
      email: data.email,
      telefono: data.telefono ?? "",
      fechaIngreso: data.fechaIngreso,
      fechaSalida: data.fechaSalida,
      numPersonas: String(data.numPersonas),
    },
  });

  return NextResponse.json({ clientSecret: intent.client_secret });
}
