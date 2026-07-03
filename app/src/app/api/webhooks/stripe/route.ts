import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { crearReservaOnline } from "@/lib/negocio/reservas";
import { enviarConfirmacion, enviarAlertaEquipo, enviarPagoFallido } from "@/lib/emails";
import { EstadoReserva, EstadoDePago } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { ulid } from "ulid";

function generarCodigoGrupo(): string {
  const id = ulid();
  return `GRP-${id.slice(-8, -4)}-${id.slice(-4)}`;
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Sin firma" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Firma inválida";
    console.error("[webhook] constructEvent error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const meta = intent.metadata;

    // Solo procesar si es un pago directo de reserva online (tiene propiedadId en metadata)
    if (!meta?.propiedadId || !meta?.tipoDeHabitacionId) {
      return NextResponse.json({ received: true });
    }

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

        // Fire-and-forget: no bloqueamos la respuesta a Stripe
        Promise.allSettled([
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
        ]).catch(() => {});
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "SIN_DISPONIBILIDAD") {
        await stripe.refunds.create({ payment_intent: intent.id });
        return NextResponse.json({ reembolsado: true });
      }
      throw err;
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.metadata?.tipo === "GRUPO_PAGO" && session.metadata?.grupoId) {
      try {
        const grupoId = session.metadata.grupoId;
        const esPagoCompleto = session.metadata.esPagoCompleto === "true";
        const estadoDePago = esPagoCompleto ? EstadoDePago.PAGADO_COMPLETO : EstadoDePago.ANTICIPO_PAGADO;

        const montoCobrado = session.amount_total ? session.amount_total / 100 : 0;

        // Acumular totalPagado en el grupo y determinar si está saldado
        const grupoActualizado = await prisma.grupoReserva.update({
          where: { id: grupoId },
          data: { totalPagado: { increment: montoCobrado } },
          include: { reservas: { where: { estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] } } } },
        });

        const totalGrupo = grupoActualizado.reservas.reduce((s, r) => s + Number(r.totalMxn), 0);
        const nuevoTotalPagado = Number(grupoActualizado.totalPagado);
        const saldado = nuevoTotalPagado >= totalGrupo;
        const estadoDePagoFinal = saldado ? EstadoDePago.PAGADO_COMPLETO : EstadoDePago.ANTICIPO_PAGADO;

        const reservas = await prisma.reserva.findMany({
          where: {
            grupoId,
            estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] },
          },
          include: { pagoManual: true },
        });

        await Promise.all(
          reservas.map((r) =>
            prisma.reserva.update({
              where: { id: r.id },
              data: {
                estado:
                  r.estado === EstadoReserva.PENDIENTE_PAGO
                    ? EstadoReserva.CONFIRMADA
                    : r.estado,
                pagoManual: r.pagoManual
                  ? { update: { estadoDePago: estadoDePagoFinal } }
                  : { create: { estadoDePago: estadoDePagoFinal } },
              },
            })
          )
        );

        const grupo = await prisma.grupoReserva.findUnique({
          where: { id: grupoId },
          include: {
            propiedad: true,
            reservas: {
              include: { huesped: true, tipoDeHabitacion: true },
              orderBy: { fechaIngreso: "asc" },
              take: 1,
            },
          },
        });

        if (grupo && grupo.reservas[0]) {
          const r0 = grupo.reservas[0];
          await enviarConfirmacion({
            emailHuesped: r0.huesped.email,
            codigoReserva: grupo.codigoGrupo,
            nombreHuesped: r0.huesped.nombre,
            nombreHotel: grupo.propiedad.nombre,
            tipoHabitacion: `Grupo ${grupo.nombre} (${reservas.length} habitación${reservas.length !== 1 ? "es" : ""})`,
            fechaIngreso: r0.fechaIngreso,
            fechaSalida: r0.fechaSalida,
            numPersonas: reservas.reduce((s, r) => s + r.numPersonas, 0),
            totalMxn: montoCobrado > 0 ? montoCobrado : nuevoTotalPagado,
            colorPrimario: grupo.propiedad.colorPrimario ?? undefined,
          });
        }
      } catch (err) {
        console.error("[webhook] GRUPO_PAGO error:", err);
      }
    }

    if (session.metadata?.tipo === "GRUPO_ONLINE" && session.metadata?.propiedadId) {
      try {
        const meta = session.metadata;
        const habsRaw = JSON.parse(meta.habitaciones) as {
          t: string; i: string; o: string; n: number;
        }[];

        const grupo = await prisma.grupoReserva.create({
          data: {
            propiedadId: meta.propiedadId,
            codigoGrupo: generarCodigoGrupo(),
            nombre: meta.nombre,
            totalPagado: session.amount_total ? session.amount_total / 100 : 0,
          },
        });

        const reservasCreadas: { id: string; codigoReserva: string }[] = [];
        for (const h of habsRaw) {
          const reserva = await crearReservaOnline({
            propiedadId: meta.propiedadId,
            tipoDeHabitacionId: h.t,
            nombre: meta.nombre,
            email: meta.email,
            telefono: meta.telefono || undefined,
            fechaIngreso: new Date(h.i),
            fechaSalida: new Date(h.o),
            numPersonas: h.n,
            stripePaymentIntentId: typeof session.payment_intent === "string"
              ? session.payment_intent
              : String(session.payment_intent ?? ""),
          });
          await prisma.reserva.update({
            where: { id: reserva.id },
            data: { grupoId: grupo.id },
          });
          reservasCreadas.push({ id: reserva.id, codigoReserva: reserva.codigoReserva });
        }

        const propiedad = await prisma.propiedad.findUnique({ where: { id: meta.propiedadId } });
        if (propiedad) {
          const primeraReserva = await prisma.reserva.findUnique({
            where: { id: reservasCreadas[0].id },
            include: { tipoDeHabitacion: true },
          });
          if (primeraReserva) {
            await enviarConfirmacion({
              emailHuesped: meta.email,
              codigoReserva: grupo.codigoGrupo,
              nombreHuesped: meta.nombre,
              nombreHotel: propiedad.nombre,
              tipoHabitacion: `${habsRaw.length} habitación${habsRaw.length !== 1 ? "es" : ""}`,
              fechaIngreso: primeraReserva.fechaIngreso,
              fechaSalida: primeraReserva.fechaSalida,
              numPersonas: habsRaw.reduce((s, h) => s + h.n, 0),
              totalMxn: session.amount_total ? session.amount_total / 100 : 0,
              colorPrimario: propiedad.colorPrimario ?? undefined,
            });
          }
        }
      } catch (err) {
        console.error("[webhook] GRUPO_ONLINE error:", err);
      }
    }

    if (session.metadata?.tipo === "MANUAL_PAGO" && session.metadata?.reservaId) {
      const reservaId = session.metadata.reservaId;
      const esPagoCompleto = session.metadata.esPagoCompleto === "true";

      const reserva = await prisma.reserva.findUnique({
        where: { id: reservaId },
        include: { huesped: true, tipoDeHabitacion: true, propiedad: true, pagoManual: true },
      });

      if (reserva && reserva.estado === EstadoReserva.PENDIENTE_PAGO) {
        await prisma.reserva.update({
          where: { id: reservaId },
          data: {
            estado: EstadoReserva.CONFIRMADA,
            pagoManual: {
              update: {
                estadoDePago: esPagoCompleto ? EstadoDePago.PAGADO_COMPLETO : EstadoDePago.ANTICIPO_PAGADO,
              },
            },
          },
        });

        const emailParams = {
          codigoReserva: reserva.codigoReserva,
          nombreHuesped: reserva.huesped.nombre,
          nombreHotel: reserva.propiedad.nombre,
          tipoHabitacion: reserva.tipoDeHabitacion.nombre,
          fechaIngreso: reserva.fechaIngreso,
          fechaSalida: reserva.fechaSalida,
          numPersonas: reserva.numPersonas,
          totalMxn: Number(reserva.totalMxn),
          colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
        };

        Promise.allSettled([
          enviarConfirmacion({ emailHuesped: reserva.huesped.email, ...emailParams }),
          reserva.propiedad.email
            ? enviarAlertaEquipo({
                emailEquipo: reserva.propiedad.email,
                emailHuesped: reserva.huesped.email,
                telefonoHuesped: reserva.huesped.telefono ?? undefined,
                origen: "MANUAL",
                ...emailParams,
              })
            : Promise.resolve(),
        ]).catch(() => {});
      }
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
        enviarPagoFallido({
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
