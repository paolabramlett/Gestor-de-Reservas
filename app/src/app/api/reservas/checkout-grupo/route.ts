import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { verificarDisponibilidadAtómica } from "@/lib/negocio/disponibilidad";
import { getPropiedadBySlug } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const habSchema = z.object({
  tipoDeHabitacionId: z.string(),
  fechaIngreso: z.string().date(),
  fechaSalida: z.string().date(),
  numPersonas: z.number().int().min(1),
});

const bodySchema = z.object({
  slug: z.string(),
  nombre: z.string().min(2),
  email: z.string().email(),
  telefono: z.string().optional(),
  habitaciones: z.array(habSchema).min(2).max(10),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = bodySchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { slug, nombre, email, telefono, habitaciones } = result.data;

  const propiedad = await getPropiedadBySlug(slug);
  if (!propiedad) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  // Verify all tipos belong to this propiedad and check availability
  let totalGeneral = 0;
  const lineItems: { name: string; amount: number; numPersonas: number }[] = [];

  for (const h of habitaciones) {
    const tipo = await prisma.tipoDeHabitacion.findFirst({
      where: { id: h.tipoDeHabitacionId, propiedadId: propiedad.id, activo: true },
    });
    if (!tipo) {
      return NextResponse.json({ error: `Tipo de habitación no encontrado` }, { status: 400 });
    }

    const fechaIn = new Date(h.fechaIngreso);
    const fechaOut = new Date(h.fechaSalida);

    const disponible = await verificarDisponibilidadAtómica(h.tipoDeHabitacionId, fechaIn, fechaOut);
    if (!disponible) {
      return NextResponse.json(
        { error: `Sin disponibilidad para ${tipo.nombre} en las fechas seleccionadas` },
        { status: 409 }
      );
    }

    const { total } = await calcularTotalReserva(h.tipoDeHabitacionId, fechaIn, fechaOut, h.numPersonas);
    totalGeneral += Number(total);
    lineItems.push({ name: tipo.nombre, amount: Number(total), numPersonas: h.numPersonas });
  }

  const host = req.headers.get("host") ?? "";
  const proto = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  // Serialize room data for metadata (compact format to stay under 500 char limit)
  const habsJson = JSON.stringify(
    habitaciones.map((h) => ({
      t: h.tipoDeHabitacionId,
      i: h.fechaIngreso,
      o: h.fechaSalida,
      n: h.numPersonas,
    }))
  );

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: email,
    line_items: lineItems.map((li) => ({
      quantity: 1,
      price_data: {
        currency: "mxn",
        unit_amount: Math.round(li.amount * 100),
        product_data: {
          name: li.name,
          description: `${li.numPersonas} persona${li.numPersonas !== 1 ? "s" : ""} · ${propiedad.nombre}`,
        },
      },
    })),
    metadata: {
      tipo: "GRUPO_ONLINE",
      propiedadId: propiedad.id,
      slug,
      nombre,
      email,
      telefono: telefono ?? "",
      habitaciones: habsJson,
    },
    success_url: `${baseUrl}/p/${slug}/pago-grupo-recibido`,
    cancel_url: `${baseUrl}/p/${slug}/reservar?cancelado=1`,
  });

  return NextResponse.json({ url: session.url });
}
