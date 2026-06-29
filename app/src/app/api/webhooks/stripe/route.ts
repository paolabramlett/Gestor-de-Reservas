import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { stripe } from "@/lib/stripe";
import { crearReservaOnline } from "@/lib/negocio/reservas";
import { enviarConfirmacion, enviarAlertaEquipo, enviarPagoFallido } from "@/lib/emails";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const TOLERANCE = 300; // 5 minutos

function verificarFirmaStripe(body: Buffer, sigHeader: string, secret: string): boolean {
  const parts: Record<string, string> = {};
  for (const part of sigHeader.split(",")) {
    const [k, ...rest] = part.split("=");
    if (k && rest.length) parts[k] = rest.join("=");
  }
  const ts = parts["t"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(ts)) > TOLERANCE) return false;

  const payload = `${ts}.${body.toString("utf8")}`;
  const expected = createHmac("sha256", secret).update(payload, "utf8").digest("hex");

  try {
    return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const buf = await req.arrayBuffer();
  const body = Buffer.from(buf);
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Sin firma" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  if (!verificarFirmaStripe(body, sig, secret)) {
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = JSON.parse(body.toString("utf8")) as Stripe.Event;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const meta = intent.metadata;

    try {
      const reserva = await crearReservaOnline({
        propiedadId: meta.propiedadId,
        tipoDeHabitacionId: meta.tipoDeHabitacionId,
        nombre: meta.nombre,
        email: meta.email,
        telefono: meta.telefono,
        fechaIngreso: new Date(meta.fechaIngreso),
        fechaSalida: new Date(meta.fechaSalida),
        numPersonas: Number(meta.numPersonas),
        stripePaymentIntentId: intent.id,
      });

      // 11.5 + 11.8: emails usando los datos del PaymentIntent metadata + propiedad
      const propiedad = await prisma.propiedad.findUnique({
        where: { id: meta.propiedadId },
      });
      const tipoHabitacion = await prisma.tipoDeHabitacion.findUnique({
        where: { id: meta.tipoDeHabitacionId },
      });
      if (propiedad && tipoHabitacion) {
        const emailParams = {
          codigoReserva: reserva.codigoReserva,
          nombreHuesped: meta.nombre,
          nombreHotel: propiedad.nombre,
          tipoHabitacion: tipoHabitacion.nombre,
          fechaIngreso: new Date(meta.fechaIngreso),
          fechaSalida: new Date(meta.fechaSalida),
          numPersonas: Number(meta.numPersonas),
          totalMxn: Number(reserva.totalMxn),
          colorPrimario: propiedad.colorPrimario ?? undefined,
        };

        await Promise.allSettled([
          enviarConfirmacion({ emailHuesped: meta.email, ...emailParams }),
          propiedad.email
            ? enviarAlertaEquipo({
                emailEquipo: propiedad.email,
                emailHuesped: meta.email,
                telefonoHuesped: meta.telefono || undefined,
                origen: "ONLINE",
                ...emailParams,
              })
            : Promise.resolve(),
        ]);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "SIN_DISPONIBILIDAD") {
        await stripe.refunds.create({ payment_intent: intent.id });
        return NextResponse.json({ reembolsado: true });
      }
      throw err;
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const meta = intent.metadata;
    if (meta?.email && meta?.nombre && meta?.propiedadId) {
      const propiedad = await prisma.propiedad.findUnique({
        where: { id: meta.propiedadId },
      });
      if (propiedad) {
        await enviarPagoFallido({
          emailHuesped: meta.email,
          nombreHuesped: meta.nombre,
          nombreHotel: propiedad.nombre,
          colorPrimario: propiedad.colorPrimario ?? undefined,
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ received: true });
}
