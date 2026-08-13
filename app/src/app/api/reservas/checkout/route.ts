import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { stripe } from "@/lib/stripe";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { verificarDisponibilidadAtómica } from "@/lib/negocio/disponibilidad";
import { getPropiedadBySlug } from "@/lib/auth";
import {
  crearClaveIdempotenciaDirectCharge,
  crearDirectCharge,
  esErrorConnectPendiente,
  mensajeErrorConnect,
} from "@/lib/stripeConnect";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validarDatosReserva } from "@/lib/negocio/reglasReserva";
import { tieneAccesoRoomly } from "@/lib/negocio/suscripciones";
import { validarCuentaConnectParaCobroDirecto } from "@/lib/stripeConnectAccount.server";
import { asociarIntentoPagoStripe, registrarIntentoPago } from "@/lib/negocio/intentosPago";

const bodySchema = z.object({
  slug: z.string(),
  tipoDeHabitacionId: z.string(),
  nombre: z.string().min(2),
  email: z.string().email(),
  telefono: z.string().optional(),
  fechaIngreso: z.string().date(),
  fechaSalida: z.string().date(),
  numPersonas: z.number().int().min(1),
  intentoId: z.string().uuid(),
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
  if (!tieneAccesoRoomly(propiedad) || propiedad.planActivo !== "PRO") {
    return NextResponse.json({ error: "Este hotel no acepta reservas en línea en este momento" }, { status: 403 });
  }

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: data.tipoDeHabitacionId, propiedadId: propiedad.id, activo: true },
    select: { capacidadMin: true, capacidadMax: true },
  });
  if (!tipo) return NextResponse.json({ error: "Tipo de habitación no encontrado" }, { status: 400 });
  try {
    validarDatosReserva(fechaIn, fechaOut, data.numPersonas, tipo.capacidadMin, tipo.capacidadMax);
  } catch {
    return NextResponse.json({ error: "Fechas o número de personas inválidos" }, { status: 400 });
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

  let intent;
  let stripeAccountId: string;
  try {
    const directCharge = crearDirectCharge(propiedad, total);
    await validarCuentaConnectParaCobroDirecto(directCharge.stripeAccountId);
    await registrarIntentoPago({
      intentoId: data.intentoId,
      propiedadId: propiedad.id,
      stripeConnectAccountId: directCharge.stripeAccountId,
      tipo: "RESERVA_INDIVIDUAL",
      montoCentavos: Math.round(total * 100),
      moneda: "mxn",
      datosReserva: {
        tipoDeHabitacionId: data.tipoDeHabitacionId,
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono ?? "",
        fechaIngreso: data.fechaIngreso,
        fechaSalida: data.fechaSalida,
        numPersonas: data.numPersonas,
      },
    });
    stripeAccountId = directCharge.stripeAccountId;
    intent = await stripe.paymentIntents.create({
      amount: Math.round(total * 100), // centavos
      currency: "mxn",
      ...directCharge.paymentIntentData,
      metadata: {
        propiedadId: propiedad.id,
        tipoDeHabitacionId: data.tipoDeHabitacionId,
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono ?? "",
        fechaIngreso: data.fechaIngreso,
        fechaSalida: data.fechaSalida,
        numPersonas: String(data.numPersonas),
        montoEsperadoCentavos: String(Math.round(total * 100)),
        moneda: "mxn",
        stripeConnectAccountId: directCharge.stripeAccountId,
        roomlyIntentoId: data.intentoId,
      },
    }, {
      ...directCharge.requestOptions,
      idempotencyKey: crearClaveIdempotenciaDirectCharge("reserva-publica", [
        propiedad.id,
        data.intentoId,
      ]),
    });
    await asociarIntentoPagoStripe(data.intentoId, { stripePaymentIntentId: intent.id });
  } catch (err) {
    const status = esErrorConnectPendiente(err) ? 409 : 500;
    return NextResponse.json({ error: mensajeErrorConnect(err) }, { status });
  }

  return NextResponse.json({ clientSecret: intent.client_secret, stripeAccountId });
}
