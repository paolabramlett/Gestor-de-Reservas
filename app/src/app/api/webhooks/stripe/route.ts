import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { crearReservaOnline, generarCodigoReserva } from "@/lib/negocio/reservas";
import { enviarConfirmacion, enviarAlertaEquipo, enviarPagoFallido } from "@/lib/emails";
import { EstadoReserva, EstadoDePago, OrigenReserva, PlanRoomly } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { ulid } from "ulid";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";

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

  // Stripe (Workbench) ahora crea un endpoint SEPARADO — con su propio
  // secreto de firma — para eventos de "Cuentas conectadas" (ej.
  // account.updated de Stripe Connect), distinto del endpoint de "Tu cuenta"
  // (suscripciones, pagos, etc.), aunque ambos apunten a esta misma URL.
  // Probamos los dos secretos conocidos antes de rechazar la firma.
  const secretos = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_CONNECT].filter(
    (s): s is string => !!s
  );

  let event: Stripe.Event | null = null;
  let ultimoError: unknown;
  for (const secreto of secretos) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secreto);
      break;
    } catch (err) {
      ultimoError = err;
    }
  }

  if (!event) {
    const msg = ultimoError instanceof Error ? ultimoError.message : "Firma inválida";
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
        // Idempotencia: si Stripe reintenta este webhook, no volver a acumular el pago
        try {
          await prisma.stripeEventoProcesado.create({
            data: { id: session.id, tipo: "GRUPO_PAGO" },
          });
        } catch (err: unknown) {
          if ((err as { code?: string })?.code === "P2002") {
            return NextResponse.json({ received: true, duplicado: true });
          }
          throw err;
        }

        const grupoId = session.metadata.grupoId;
        const esPagoCompleto = session.metadata.esPagoCompleto === "true";
        const estadoDePago = esPagoCompleto ? EstadoDePago.PAGADO_COMPLETO : EstadoDePago.ANTICIPO_PAGADO;

        const montoCobrado = session.amount_total ? session.amount_total / 100 : 0;
        // BUG 11: guardar stripePaymentIntentId en el grupo para poder reembolsar después
        const piId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

        // Acumular totalPagado en el grupo y determinar si está saldado
        const grupoActualizado = await prisma.grupoReserva.update({
          where: { id: grupoId },
          data: {
            totalPagado: { increment: montoCobrado },
            ...(piId ? { stripePaymentIntentId: piId } : {}),
          },
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
                // BUG 5: upsert para no fallar si pagoManual no existe
                pagoManual: {
                  upsert: {
                    create: { estadoDePago: estadoDePagoFinal },
                    update: { estadoDePago: estadoDePagoFinal },
                  },
                },
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
        // Idempotencia: evitar crear el grupo dos veces si Stripe reintenta
        try {
          await prisma.stripeEventoProcesado.create({
            data: { id: session.id, tipo: "GRUPO_ONLINE" },
          });
        } catch (err: unknown) {
          if ((err as { code?: string })?.code === "P2002") {
            return NextResponse.json({ received: true, duplicado: true });
          }
          throw err;
        }

        const meta = session.metadata;
        const habsRaw = JSON.parse(meta.habitaciones) as {
          t: string; i: string; o: string; n: number;
        }[];
        const stripePaymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent : null;
        const montoCobrado = session.amount_total ? session.amount_total / 100 : 0;

        // BUG 3: pre-calcular totales fuera de la transacción
        let fechaIngresoMin: Date | null = null;
        let fechaSalidaMax: Date | null = null;
        let totalPersonas = 0;
        const roomsData: { t: string; fechaIn: Date; fechaOut: Date; n: number; total: number; desglose: unknown }[] = [];

        for (const h of habsRaw) {
          const fechaIn = new Date(h.i);
          const fechaOut = new Date(h.o);
          const { total, desglose } = await calcularTotalReserva(h.t, fechaIn, fechaOut, h.n);
          roomsData.push({ t: h.t, fechaIn, fechaOut, n: h.n, total: Number(total), desglose });
          if (!fechaIngresoMin || fechaIn < fechaIngresoMin) fechaIngresoMin = fechaIn;
          if (!fechaSalidaMax || fechaOut > fechaSalidaMax) fechaSalidaMax = fechaOut;
          totalPersonas += h.n;
        }

        // BUG 3 + 14: crear grupo y todas las reservas en una sola transacción;
        // reintentar hasta 3 veces si hay colisión de codigoGrupo (Prisma P2002)
        let grupo!: { id: string; codigoGrupo: string };
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const codigoGrupo = generarCodigoGrupo();
            grupo = await prisma.$transaction(async (tx) => {
              const g = await tx.grupoReserva.create({
                data: {
                  propiedadId: meta.propiedadId,
                  codigoGrupo,
                  nombre: meta.nombre,
                  totalPagado: montoCobrado,
                  stripePaymentIntentId,
                },
              });

              // Un huésped nuevo por cada reserva de grupo, aunque el correo se repita.
              const huesped = await tx.huesped.create({
                data: { nombre: meta.nombre, email: meta.email.toLowerCase(), telefono: meta.telefono || null, propiedadId: meta.propiedadId },
              });

              for (const room of roomsData) {
                await tx.reserva.create({
                  data: {
                    codigoReserva: generarCodigoReserva(),
                    propiedadId: meta.propiedadId,
                    tipoDeHabitacionId: room.t,
                    huespedId: huesped.id,
                    nombreHuesped: meta.nombre,
                    origen: OrigenReserva.ONLINE,
                    estado: EstadoReserva.CONFIRMADA,
                    fechaIngreso: room.fechaIn,
                    fechaSalida: room.fechaOut,
                    numPersonas: room.n,
                    totalMxn: room.total,
                    desglosePorNoche: room.desglose as import("@prisma/client").Prisma.InputJsonValue,
                    grupoId: g.id,
                  },
                });
              }

              return { id: g.id, codigoGrupo: g.codigoGrupo };
            });
            break;
          } catch (err: unknown) {
            const prismaErr = err as { code?: string; meta?: { target?: string[] } };
            const esColision = prismaErr?.code === "P2002" && prismaErr?.meta?.target?.includes("codigoGrupo");
            if (attempt < 2 && esColision) continue;
            throw err;
          }
        }

        const propiedad = await prisma.propiedad.findUnique({ where: { id: meta.propiedadId } });
        if (propiedad && fechaIngresoMin && fechaSalidaMax) {
          await enviarConfirmacion({
            emailHuesped: meta.email,
            codigoReserva: grupo.codigoGrupo,
            nombreHuesped: meta.nombre,
            nombreHotel: propiedad.nombre,
            tipoHabitacion: `${habsRaw.length} habitacion${habsRaw.length !== 1 ? "es" : ""}`,
            fechaIngreso: fechaIngresoMin,
            fechaSalida: fechaSalidaMax,
            numPersonas: totalPersonas,
            totalMxn: montoCobrado,
            colorPrimario: propiedad.colorPrimario ?? undefined,
          });
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
        // BUG 5: upsert para no fallar si pagoManual no existe
        await prisma.reserva.update({
          where: { id: reservaId },
          data: {
            estado: EstadoReserva.CONFIRMADA,
            pagoManual: {
              upsert: {
                create: { estadoDePago: esPagoCompleto ? EstadoDePago.PAGADO_COMPLETO : EstadoDePago.ANTICIPO_PAGADO },
                update: { estadoDePago: esPagoCompleto ? EstadoDePago.PAGADO_COMPLETO : EstadoDePago.ANTICIPO_PAGADO },
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

  // Cuenta de Stripe Connect de un hotel cambió de estado (ej. terminó su
  // onboarding, o Stripe le pidió más información y quedó deshabilitada).
  // Fuente de verdad principal para stripeConnectHabilitado — el redirect
  // de /api/stripe-connect/return solo da feedback inmediato en pantalla.
  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    await prisma.propiedad.updateMany({
      where: { stripeConnectAccountId: account.id },
      data: { stripeConnectHabilitado: !!account.charges_enabled },
    });
  }

  // Suscripción cancelada → marcar hotel como inactivo
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await prisma.propiedad.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { suscripcionActiva: false },
    });
  }

  // Cambios de plan/estado hechos fuera de la app (ej. portal de Stripe) —
  // mantiene la DB sincronizada como fuente de verdad secundaria.
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object as Stripe.Subscription;
    const priceId = subscription.items.data[0]?.price?.id;
    const plan =
      priceId === process.env.STRIPE_PRICE_PRO ? PlanRoomly.PRO : PlanRoomly.ESENCIAL;
    const periodoTs =
      (subscription.items.data[0] as { current_period_end?: number } | undefined)
        ?.current_period_end ?? (subscription as unknown as { current_period_end?: number }).current_period_end;

    await prisma.propiedad.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        planActivo: plan,
        suscripcionActiva: subscription.status === "active" || subscription.status === "trialing",
        canceladaAlFinalDePeriodo: subscription.cancel_at_period_end,
        finDePeriodoActual: periodoTs ? new Date(periodoTs * 1000) : null,
      },
    });
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
