import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { stripe } from "@/lib/stripe";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { calcularDisponibilidad } from "@/lib/negocio/disponibilidad";
import { getPropiedadBySlug } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { datosPagoDestino, esErrorConnectPendiente, mensajeErrorConnect } from "@/lib/stripeConnect";
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
  if (!rateLimit(req, { limite: 20, ventanaMs: 60_000 })) {
    return NextResponse.json({ error: "Demasiadas solicitudes, intenta de nuevo en un minuto" }, { status: 429 });
  }

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
  if (!propiedad.suscripcionActiva || propiedad.planActivo !== "PRO") {
    return NextResponse.json({ error: "Este hotel no acepta reservas en línea en este momento" }, { status: 403 });
  }

  // Verify all tipos belong to this propiedad
  const tipos = new Map<string, { id: string; nombre: string }>();
  for (const h of habitaciones) {
    if (tipos.has(h.tipoDeHabitacionId)) continue;
    const tipo = await prisma.tipoDeHabitacion.findFirst({
      where: { id: h.tipoDeHabitacionId, propiedadId: propiedad.id, activo: true },
    });
    if (!tipo) {
      return NextResponse.json({ error: `Tipo de habitación no encontrado` }, { status: 400 });
    }
    tipos.set(h.tipoDeHabitacionId, tipo);
  }

  // Verificar disponibilidad agregando la demanda por tipo+fechas: pedir 3
  // "Suite Deluxe" en el mismo carrito debe compararse contra el inventario
  // real, no verificarse habitación por habitación (eso siempre ve "queda
  // al menos 1" porque nada se reserva hasta el pago, permitiendo pedir más
  // cuartos de los que existen).
  const demandaPorTipoYFechas = new Map<string, { tipoDeHabitacionId: string; fechaIn: Date; fechaOut: Date; cantidad: number }>();
  for (const h of habitaciones) {
    const fechaIn = new Date(h.fechaIngreso);
    const fechaOut = new Date(h.fechaSalida);
    const key = `${h.tipoDeHabitacionId}|${h.fechaIngreso}|${h.fechaSalida}`;
    const actual = demandaPorTipoYFechas.get(key);
    if (actual) actual.cantidad += 1;
    else demandaPorTipoYFechas.set(key, { tipoDeHabitacionId: h.tipoDeHabitacionId, fechaIn, fechaOut, cantidad: 1 });
  }

  for (const d of demandaPorTipoYFechas.values()) {
    const disponibles = await calcularDisponibilidad(d.tipoDeHabitacionId, d.fechaIn, d.fechaOut);
    if (disponibles < d.cantidad) {
      const tipo = tipos.get(d.tipoDeHabitacionId)!;
      return NextResponse.json(
        {
          error:
            disponibles > 0
              ? `Solo quedan ${disponibles} habitación(es) de ${tipo.nombre} disponibles para esas fechas`
              : `Sin disponibilidad para ${tipo.nombre} en las fechas seleccionadas`,
        },
        { status: 409 }
      );
    }
  }

  let totalGeneral = 0;
  const lineItems: { name: string; amount: number; numPersonas: number }[] = [];

  for (const h of habitaciones) {
    const tipo = tipos.get(h.tipoDeHabitacionId)!;
    const fechaIn = new Date(h.fechaIngreso);
    const fechaOut = new Date(h.fechaSalida);

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

  let session;
  try {
    session = await stripe.checkout.sessions.create({
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
      payment_intent_data: datosPagoDestino(propiedad, totalGeneral),
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
  } catch (err) {
    const status = esErrorConnectPendiente(err) ? 409 : 500;
    return NextResponse.json({ error: mensajeErrorConnect(err) }, { status });
  }

  return NextResponse.json({ url: session.url });
}
