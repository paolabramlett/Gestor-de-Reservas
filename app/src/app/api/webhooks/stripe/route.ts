import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { crearReservaOnline, generarCodigoReserva } from "@/lib/negocio/reservas";
import { enviarAlertaEquipo, enviarComprobantePago, enviarPagoFallido } from "@/lib/emails";
import { EstadoReserva, OrigenReserva, PlanRoomly } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";
import { ulid } from "ulid";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { reembolsarPagoDirectoHuesped, reembolsarPagoHuesped } from "@/lib/stripeConnect";
import { bloquearInventarioTipo, calcularDisponibilidad } from "@/lib/negocio/disponibilidad";
import { validarCuentaEvento, validarDestinoPago, validarPagoRecibido } from "@/lib/negocio/pagosOnline";
import { exigirIntentoPagoAutorizado, marcarIntentoPagoPagado, obtenerIntentoPago } from "@/lib/negocio/intentosPago";
import { aCentavos, calcularResumenFinanciero } from "@/lib/negocio/resumenFinanciero";
import { puedeSolicitarPagoPorFecha } from "@/lib/negocio/vencimientoPagos";

function generarCodigoGrupo(): string {
  const id = ulid();
  return `GRP-${id.slice(-8, -4)}-${id.slice(-4)}`;
}

async function validarSesionDePago(
  session: Stripe.Checkout.Session,
  cuentaEvento: string | null
): Promise<{ intent: Stripe.PaymentIntent; cuentaCobroDirecto: string | null }> {
  const esperado = Number(session.metadata?.montoEsperadoCentavos);
  validarPagoRecibido({
    paymentStatus: session.payment_status,
    moneda: session.currency,
    montoRecibidoCentavos: session.amount_total,
    montoEsperadoCentavos: esperado,
  });
  const piId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id;
  if (!piId) throw new Error("PAGO_STRIPE_INCONSISTENTE");
  const intentoId = session.metadata?.roomlyIntentoId;
  const intento = intentoId ? await obtenerIntentoPago(intentoId) : null;
  const propiedadId = session.metadata?.propiedadId;
  const propiedad = !intento && propiedadId
    ? await prisma.propiedad.findUnique({ where: { id: propiedadId }, select: { stripeConnectAccountId: true } })
    : null;
  const cuentaEsperada = intento?.stripeConnectAccountId ?? propiedad?.stripeConnectAccountId ?? "";
  if (cuentaEvento) {
    validarCuentaEvento(cuentaEvento, cuentaEsperada);
    const intent = await stripe.paymentIntents.retrieve(piId, {}, { stripeAccount: cuentaEvento });
    if (intent.transfer_data?.destination) throw new Error("DESTINO_STRIPE_INCONSISTENTE");
    return { intent, cuentaCobroDirecto: cuentaEvento };
  }

  // Compatibilidad exclusiva con cobros históricos creados en Roomly y
  // transferidos al hotel. Los nuevos checkouts siempre llevan event.account.
  const intent = await stripe.paymentIntents.retrieve(piId);
  const destino = typeof intent.transfer_data?.destination === "string"
    ? intent.transfer_data.destination
    : intent.transfer_data?.destination?.id ?? null;
  validarDestinoPago(destino, cuentaEsperada);
  return { intent, cuentaCobroDirecto: null };
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
  const secretos = [
    { tipo: "PLATAFORMA" as const, valor: process.env.STRIPE_WEBHOOK_SECRET },
    { tipo: "CONNECT" as const, valor: process.env.STRIPE_WEBHOOK_SECRET_CONNECT },
  ].filter((item): item is { tipo: "PLATAFORMA" | "CONNECT"; valor: string } => !!item.valor);

  let event: Stripe.Event | null = null;
  let origenFirma: "PLATAFORMA" | "CONNECT" | null = null;
  let ultimoError: unknown;
  for (const secreto of secretos) {
    try {
      event = stripe.webhooks.constructEvent(body, sig, secreto.valor);
      origenFirma = secreto.tipo;
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

  const esEventoCuentaConectada = !!event.account || event.type === "account.updated";
  if ((esEventoCuentaConectada && origenFirma !== "CONNECT") || (!esEventoCuentaConectada && origenFirma !== "PLATAFORMA")) {
    return NextResponse.json({ error: "Origen de webhook incorrecto" }, { status: 400 });
  }
  const claveStripe = process.env.STRIPE_SECRET_KEY ?? "";
  const modoEsperado = claveStripe.startsWith("sk_live_")
    ? "LIVE"
    : claveStripe.startsWith("sk_test_")
      ? "TEST"
      : null;
  if ((modoEsperado === "LIVE" && !event.livemode) || (modoEsperado === "TEST" && event.livemode)) {
    return NextResponse.json({ error: "Modo de webhook incorrecto" }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const meta = intent.metadata;

    // Solo procesar si es un pago directo de reserva online (tiene propiedadId en metadata)
    if (!meta?.propiedadId || !meta?.tipoDeHabitacionId) {
      return NextResponse.json({ received: true });
    }

    let cuentaCobroDirecto: string | null = null;
    try {
      const propiedadPago = await prisma.propiedad.findUnique({
        where: { id: meta.propiedadId },
        select: { stripeConnectAccountId: true },
      });
      if (!propiedadPago?.stripeConnectAccountId) throw new Error("DESTINO_STRIPE_INCONSISTENTE");
      const intentoPago = meta.roomlyIntentoId ? await obtenerIntentoPago(meta.roomlyIntentoId) : null;
      const cuentaAutorizada = intentoPago?.stripeConnectAccountId ?? propiedadPago.stripeConnectAccountId;
      const destino = typeof intent.transfer_data?.destination === "string"
        ? intent.transfer_data.destination
        : intent.transfer_data?.destination?.id ?? null;
      const esCobroDirecto = destino === null;
      if (esCobroDirecto) {
        validarCuentaEvento(event.account ?? null, cuentaAutorizada);
        cuentaCobroDirecto = cuentaAutorizada;
      } else {
        validarDestinoPago(destino, propiedadPago.stripeConnectAccountId);
      }
      validarPagoRecibido({
        paymentStatus: intent.status === "succeeded" ? "paid" : intent.status,
        moneda: intent.currency,
        montoRecibidoCentavos: intent.amount_received,
        montoEsperadoCentavos: Number(meta.montoEsperadoCentavos),
      });
      if (esCobroDirecto) {
        const intentoAutorizado = await exigirIntentoPagoAutorizado({
          intentoId: meta.roomlyIntentoId ?? "",
          propiedadId: meta.propiedadId,
          stripeConnectAccountId: cuentaAutorizada,
          montoCentavos: intent.amount_received,
          moneda: "mxn",
          stripePaymentIntentId: intent.id,
        });
        const datos = intentoAutorizado.datosReserva as {
          tipoDeHabitacionId: string; nombre: string; email: string; telefono: string;
          fechaIngreso: string; fechaSalida: string; numPersonas: number;
        };
        Object.assign(meta, {
          tipoDeHabitacionId: datos.tipoDeHabitacionId,
          nombre: datos.nombre,
          email: datos.email,
          telefono: datos.telefono,
          fechaIngreso: datos.fechaIngreso,
          fechaSalida: datos.fechaSalida,
          numPersonas: String(datos.numPersonas),
        });
      }
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
        montoPagadoMxn: intent.amount_received / 100,
        modeloCobro: esCobroDirecto ? "DIRECT" : "DESTINATION_LEGACY",
        stripeConnectAccountId: esCobroDirecto ? cuentaAutorizada : null,
      });
      if (esCobroDirecto) await marcarIntentoPagoPagado(meta.roomlyIntentoId);

      // 11.5 + 11.8: emails usando los datos del PaymentIntent metadata + propiedad
      const propiedad = await prisma.propiedad.findUnique({
        where: { id: meta.propiedadId },
      });
      const tipoHabitacion = await prisma.tipoDeHabitacion.findUnique({
        where: { id: meta.tipoDeHabitacionId },
      });
      if (propiedad && tipoHabitacion) {
        const datosReservaCorreo = {
          codigoReserva: reserva.codigoReserva,
          nombreHuesped: meta.nombre,
          nombreHotel: propiedad.nombre,
          tipoHabitacion: tipoHabitacion.nombre,
          fechaIngreso: new Date(meta.fechaIngreso),
          fechaSalida: new Date(meta.fechaSalida),
          numPersonas: Number(meta.numPersonas),
          colorPrimario: propiedad.colorPrimario ?? undefined,
        };
        const totalReservaCentavos = aCentavos(Number(reserva.totalMxn));
        const resumenPago = calcularResumenFinanciero({
          totalReservaCentavos,
          pagosStripe: [{
            cobradoCentavos: intent.amount_received,
            reembolsadoCentavos: 0,
            reembolsoPendienteCentavos: 0,
          }],
          pagosExternos: [],
        });

        // Fire-and-forget: no bloqueamos la respuesta a Stripe
        Promise.allSettled([
          enviarComprobantePago({
            emailHuesped: meta.email,
            ...datosReservaCorreo,
            montoRecibidoCentavos: intent.amount_received,
            totalPagadoCentavos: resumenPago.pagadoNetoCentavos,
            totalReservaCentavos,
            saldoPendienteCentavos: resumenPago.saldoPendienteCentavos,
          }),
          propiedad.email
            ? enviarAlertaEquipo({
                emailEquipo: propiedad.email,
                emailHuesped: meta.email,
                telefonoHuesped: meta.telefono || undefined,
                origen: "ONLINE",
                ...datosReservaCorreo,
                totalMxn: Number(reserva.totalMxn),
              })
            : Promise.resolve(),
        ]).catch(() => {});
      }
    } catch (err: unknown) {
      if (err instanceof Error && [
        "SIN_DISPONIBILIDAD",
        "PAGO_STRIPE_INCONSISTENTE",
        "DESTINO_STRIPE_INCONSISTENTE",
        "TIPO_HABITACION_INVALIDO",
        "FECHAS_INVALIDAS",
        "CAPACIDAD_INVALIDA",
        "INTENTO_PAGO_NO_AUTORIZADO",
      ].includes(err.message)) {
        if (cuentaCobroDirecto) {
          await reembolsarPagoDirectoHuesped(
            intent.id,
            cuentaCobroDirecto,
            undefined,
            `roomly-no-availability-${intent.id}`
          );
        } else {
          await reembolsarPagoHuesped(intent.id, undefined, `roomly-no-availability-${intent.id}`);
        }
        return NextResponse.json({ reembolsado: true });
      }
      throw err;
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    let cuentaCheckoutDirecto: string | null = null;
    if (["GRUPO_PAGO", "GRUPO_ONLINE", "MANUAL_PAGO"].includes(session.metadata?.tipo ?? "")) {
      try {
        const validacion = await validarSesionDePago(session, event.account ?? null);
        cuentaCheckoutDirecto = validacion.cuentaCobroDirecto;
        if (cuentaCheckoutDirecto) {
          await exigirIntentoPagoAutorizado({
            intentoId: session.metadata?.roomlyIntentoId ?? "",
            propiedadId: session.metadata?.propiedadId ?? "",
            stripeConnectAccountId: cuentaCheckoutDirecto,
            montoCentavos: session.amount_total ?? 0,
            moneda: "mxn",
            stripePaymentIntentId: validacion.intent.id,
            stripeCheckoutSessionId: session.id,
          });
        }
      } catch (err) {
        console.error("[webhook] Checkout inconsistente:", session.id, err);
        const piId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;
        // Si Stripe ya capturó dinero pero el monto, moneda, tenant o destino
        // no coincide con lo cotizado, no hay una reserva válida que crear.
        if (session.payment_status === "paid" && piId) {
          if (event.account) {
            await reembolsarPagoDirectoHuesped(piId, event.account, undefined, `roomly-invalid-checkout-${piId}`);
          } else {
            await reembolsarPagoHuesped(piId, undefined, `roomly-invalid-checkout-${piId}`);
          }
          return NextResponse.json({ received: true, reembolsado: true });
        }
        return NextResponse.json({ error: "Pago inconsistente" }, { status: 400 });
      }
    }

    if (session.metadata?.tipo === "GRUPO_PAGO" && session.metadata?.grupoId) {
      try {
        const grupoId = session.metadata.grupoId;
        const montoCobrado = session.amount_total ? session.amount_total / 100 : 0;
        // BUG 11: guardar stripePaymentIntentId en el grupo para poder reembolsar después
        const piId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent as Stripe.PaymentIntent | null)?.id ?? null;

        if (!piId) throw new Error("PAGO_STRIPE_INCONSISTENTE");
        const resultadoGrupo = await prisma.$transaction(async (tx) => {
          // Serializa pagos distintos del mismo grupo. Sin este lock, dos
          // checkouts simultáneos pueden leer el mismo saldo y sobrecobrarlo.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${grupoId}, 2))`;
          const grupoBase = await tx.grupoReserva.findFirst({
            where: { id: grupoId, propiedadId: session.metadata!.propiedadId },
            include: {
              propiedad: { select: { horaCheckOut: true } },
              reservas: { where: { estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] } } },
            },
          });
          if (!grupoBase) throw new Error("GRUPO_INVALIDO");
          const totalGrupoBase = grupoBase.reservas.reduce((s, r) => s + Number(r.totalMxn), 0);
          const restante = totalGrupoBase - Number(grupoBase.totalPagado);
          const fechaSalidaMax = grupoBase.reservas.reduce(
            (max, r) => (r.fechaSalida > max ? r.fechaSalida : max),
            grupoBase.reservas[0]?.fechaSalida ?? new Date(0)
          );
          const periodoVencido = !puedeSolicitarPagoPorFecha({
            estado: "CONFIRMADA",
            fechaSalida: fechaSalidaMax,
            horaCheckOut: grupoBase.propiedad.horaCheckOut,
          });
          const esExceso = periodoVencido || montoCobrado > restante + 0.005;
          const pago = await tx.pagoOnline.create({
            data: {
              propiedadId: grupoBase.propiedadId,
              grupoId,
              stripePaymentIntentId: piId,
              stripeCheckoutSessionId: session.id,
              montoMxn: montoCobrado,
              moneda: session.currency ?? "mxn",
              modeloCobro: cuentaCheckoutDirecto ? "DIRECT" : "DESTINATION_LEGACY",
              stripeConnectAccountId: cuentaCheckoutDirecto,
              estado: esExceso ? "REEMBOLSO_PENDIENTE" : "PAGADO",
              reembolsoPendienteMxn: esExceso ? montoCobrado : 0,
            },
          });
          if (esExceso) {
            return { grupoActualizado: grupoBase, reservas: grupoBase.reservas, nuevoTotalPagado: Number(grupoBase.totalPagado), reembolsar: true, pagoId: pago.id };
          }
          const actualizado = await tx.grupoReserva.update({
            where: { id: grupoId },
            data: { totalPagado: { increment: montoCobrado }, stripePaymentIntentId: piId },
            include: { reservas: { where: { estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] } } } },
          });
          const totalPagado = Number(actualizado.totalPagado);
          const activas = await tx.reserva.findMany({
            where: { grupoId, estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] } },
          });
          for (const r of activas) {
            await tx.reserva.update({
              where: { id: r.id },
              data: {
                estado:
                  r.estado === EstadoReserva.PENDIENTE_PAGO
                    ? EstadoReserva.CONFIRMADA
                    : r.estado,
              },
            });
          }
          return { grupoActualizado: actualizado, reservas: activas, nuevoTotalPagado: totalPagado, reembolsar: false, pagoId: pago.id };
        });
        if (resultadoGrupo.reembolsar) {
          try {
            if (cuentaCheckoutDirecto) {
              await reembolsarPagoDirectoHuesped(piId, cuentaCheckoutDirecto);
            } else {
              await reembolsarPagoHuesped(piId);
            }
            await prisma.pagoOnline.update({
              where: { id: resultadoGrupo.pagoId },
              data: { estado: "REEMBOLSADO", montoReembolsadoMxn: montoCobrado, reembolsoPendienteMxn: 0 },
            });
            return NextResponse.json({ received: true, reembolsado: true });
          } catch (err) {
            throw err;
          }
        }
        const { reservas, nuevoTotalPagado } = resultadoGrupo;

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
          const totalReservaCentavos = aCentavos(
            reservas.reduce((total, reserva) => total + Number(reserva.totalMxn), 0)
          );
          const resumenPago = calcularResumenFinanciero({
            totalReservaCentavos,
            pagosStripe: [{
              cobradoCentavos: aCentavos(nuevoTotalPagado),
              reembolsadoCentavos: 0,
              reembolsoPendienteCentavos: 0,
            }],
            pagosExternos: [],
          });
          await enviarComprobantePago({
            emailHuesped: r0.huesped.email,
            codigoReserva: grupo.codigoGrupo,
            nombreHuesped: r0.huesped.nombre,
            nombreHotel: grupo.propiedad.nombre,
            tipoHabitacion: `Grupo ${grupo.nombre} (${reservas.length} habitación${reservas.length !== 1 ? "es" : ""})`,
            fechaIngreso: r0.fechaIngreso,
            fechaSalida: r0.fechaSalida,
            numPersonas: reservas.reduce((s, r) => s + r.numPersonas, 0),
            montoRecibidoCentavos: session.amount_total ?? 0,
            totalPagadoCentavos: resumenPago.pagadoNetoCentavos,
            totalReservaCentavos,
            saldoPendienteCentavos: resumenPago.saldoPendienteCentavos,
            colorPrimario: grupo.propiedad.colorPrimario ?? undefined,
          });
        }
        if (cuentaCheckoutDirecto) await marcarIntentoPagoPagado(session.metadata.roomlyIntentoId);
      } catch (err) {
        if ((err as { code?: string })?.code === "P2002") {
          const piDuplicado = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
          const pagoPendiente = piDuplicado
            ? await prisma.pagoOnline.findUnique({ where: { stripePaymentIntentId: piDuplicado } })
            : null;
          if (piDuplicado && pagoPendiente?.estado === "REEMBOLSO_PENDIENTE") {
            const centavos = Math.round(Number(pagoPendiente.reembolsoPendienteMxn) * 100);
            if (pagoPendiente.stripeConnectAccountId) {
              await reembolsarPagoDirectoHuesped(piDuplicado, pagoPendiente.stripeConnectAccountId, centavos, `roomly-refund-${pagoPendiente.id}-${centavos}`);
            } else {
              await reembolsarPagoHuesped(piDuplicado, centavos, `roomly-refund-${pagoPendiente.id}-${centavos}`);
            }
            await prisma.pagoOnline.update({
              where: { id: pagoPendiente.id },
              data: { estado: "REEMBOLSADO", montoReembolsadoMxn: pagoPendiente.montoMxn, reembolsoPendienteMxn: 0 },
            });
            return NextResponse.json({ received: true, reembolsado: true });
          }
          return NextResponse.json({ received: true, duplicado: true });
        }
        console.error("[webhook] GRUPO_PAGO error:", err);
        throw err;
      }
    }

    if (session.metadata?.tipo === "GRUPO_ONLINE" && session.metadata?.propiedadId) {
      try {
        const meta = session.metadata;
        const habsRaw = JSON.parse(meta.habitaciones) as {
          t: string; i: string; o: string; n: number;
        }[];
        const stripePaymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent : null;
        const montoCobrado = session.amount_total ? session.amount_total / 100 : 0;
        if (!stripePaymentIntentId) throw new Error("PAGO_STRIPE_INCONSISTENTE");
        if (cuentaCheckoutDirecto) {
          const intentoAutorizado = await exigirIntentoPagoAutorizado({
            intentoId: meta.roomlyIntentoId ?? "",
            propiedadId: meta.propiedadId,
            stripeConnectAccountId: cuentaCheckoutDirecto,
            montoCentavos: session.amount_total ?? 0,
            moneda: "mxn",
            stripePaymentIntentId,
            stripeCheckoutSessionId: session.id,
          });
          const datos = intentoAutorizado.datosReserva as {
            habitaciones: Array<{ tipoDeHabitacionId: string; fechaIngreso: string; fechaSalida: string; numPersonas: number }>;
            nombre: string; email: string; telefono: string;
          };
          meta.nombre = datos.nombre;
          meta.email = datos.email;
          meta.telefono = datos.telefono;
          meta.habitaciones = JSON.stringify(datos.habitaciones.map((h) => ({
            t: h.tipoDeHabitacionId, i: h.fechaIngreso, o: h.fechaSalida, n: h.numPersonas,
          })));
        }
        const pagoExistente = await prisma.pagoOnline.findUnique({
          where: { stripePaymentIntentId },
          select: { id: true },
        });
        if (pagoExistente) return NextResponse.json({ received: true, duplicado: true });

        // BUG 3: pre-calcular totales fuera de la transacción
        let fechaIngresoMin: Date | null = null;
        let fechaSalidaMax: Date | null = null;
        let totalPersonas = 0;
        const roomsData: { t: string; fechaIn: Date; fechaOut: Date; n: number; total: number; desglose: unknown }[] = [];
        const lineItems = await stripe.checkout.sessions.listLineItems(
          session.id,
          { limit: 100 },
          cuentaCheckoutDirecto ? { stripeAccount: cuentaCheckoutDirecto } : undefined
        );
        if (lineItems.data.length !== habsRaw.length) throw new Error("PAGO_STRIPE_INCONSISTENTE");

        for (const [index, h] of habsRaw.entries()) {
          const fechaIn = new Date(h.i);
          const fechaOut = new Date(h.o);
          const tipo = await prisma.tipoDeHabitacion.findFirst({
            where: { id: h.t, propiedadId: meta.propiedadId, activo: true },
            select: { capacidadMin: true, capacidadMax: true },
          });
          if (!tipo || fechaOut <= fechaIn || h.n < tipo.capacidadMin || h.n > tipo.capacidadMax) {
            throw new Error("DATOS_RESERVA_INVALIDOS");
          }
          const { desglose } = await calcularTotalReserva(h.t, fechaIn, fechaOut, h.n);
          const totalCotizado = (lineItems.data[index].amount_total ?? 0) / 100;
          if (totalCotizado <= 0) throw new Error("PAGO_STRIPE_INCONSISTENTE");
          roomsData.push({ t: h.t, fechaIn, fechaOut, n: h.n, total: totalCotizado, desglose });
          if (!fechaIngresoMin || fechaIn < fechaIngresoMin) fechaIngresoMin = fechaIn;
          if (!fechaSalidaMax || fechaOut > fechaSalidaMax) fechaSalidaMax = fechaOut;
          totalPersonas += h.n;
        }

        // Re-verificar disponibilidad: entre crear el checkout y completar el
        // pago pudo venderse el último cuarto. Si ya no alcanza, reembolso
        // completo automático (mismo patrón que las reservas individuales).
        const demandaPorTipoYFechas = new Map<string, { t: string; fechaIn: Date; fechaOut: Date; cantidad: number }>();
        for (const room of roomsData) {
          const key = `${room.t}|${room.fechaIn.toISOString()}|${room.fechaOut.toISOString()}`;
          const d = demandaPorTipoYFechas.get(key);
          if (d) d.cantidad += 1;
          else demandaPorTipoYFechas.set(key, { t: room.t, fechaIn: room.fechaIn, fechaOut: room.fechaOut, cantidad: 1 });
        }
        for (const d of demandaPorTipoYFechas.values()) {
          const disponibles = await calcularDisponibilidad(d.t, d.fechaIn, d.fechaOut);
          if (disponibles < d.cantidad) {
            if (stripePaymentIntentId) {
              if (cuentaCheckoutDirecto) {
                await reembolsarPagoDirectoHuesped(stripePaymentIntentId, cuentaCheckoutDirecto, undefined, `roomly-no-availability-${stripePaymentIntentId}`);
              } else {
                await reembolsarPagoHuesped(stripePaymentIntentId, undefined, `roomly-no-availability-${stripePaymentIntentId}`);
              }
            }
            console.error("[webhook] GRUPO_ONLINE sin disponibilidad al confirmar — reembolsado:", session.id);
            return NextResponse.json({ reembolsado: true });
          }
        }

        // BUG 3 + 14: crear grupo y todas las reservas en una sola transacción;
        // reintentar hasta 3 veces si hay colisión de codigoGrupo (Prisma P2002)
        let grupo!: { id: string; codigoGrupo: string };
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const codigoGrupo = generarCodigoGrupo();
            grupo = await prisma.$transaction(async (tx) => {
              for (const tipoId of [...new Set(roomsData.map((room) => room.t))].sort()) {
                await bloquearInventarioTipo(tx, tipoId);
              }
              for (const d of demandaPorTipoYFechas.values()) {
                const disponibles = await calcularDisponibilidad(d.t, d.fechaIn, d.fechaOut, tx);
                if (disponibles < d.cantidad) throw new Error("SIN_DISPONIBILIDAD");
              }
              const g = await tx.grupoReserva.create({
                data: {
                  propiedadId: meta.propiedadId,
                  codigoGrupo,
                  nombre: meta.nombre,
                  totalPagado: montoCobrado,
                  stripePaymentIntentId,
                },
              });

              if (!stripePaymentIntentId) throw new Error("PAGO_STRIPE_INCONSISTENTE");
              await tx.pagoOnline.create({
                data: {
                  propiedadId: meta.propiedadId,
                  grupoId: g.id,
                  stripePaymentIntentId,
                  stripeCheckoutSessionId: session.id,
                  montoMxn: montoCobrado,
                  moneda: session.currency ?? "mxn",
                  modeloCobro: cuentaCheckoutDirecto ? "DIRECT" : "DESTINATION_LEGACY",
                  stripeConnectAccountId: cuentaCheckoutDirecto,
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
          const totalReservaCentavos = aCentavos(
            roomsData.reduce((total, room) => total + room.total, 0)
          );
          const resumenPago = calcularResumenFinanciero({
            totalReservaCentavos,
            pagosStripe: [{
              cobradoCentavos: session.amount_total ?? 0,
              reembolsadoCentavos: 0,
              reembolsoPendienteCentavos: 0,
            }],
            pagosExternos: [],
          });
          await enviarComprobantePago({
            emailHuesped: meta.email,
            codigoReserva: grupo.codigoGrupo,
            nombreHuesped: meta.nombre,
            nombreHotel: propiedad.nombre,
            tipoHabitacion: `${habsRaw.length} habitacion${habsRaw.length !== 1 ? "es" : ""}`,
            fechaIngreso: fechaIngresoMin,
            fechaSalida: fechaSalidaMax,
            numPersonas: totalPersonas,
            montoRecibidoCentavos: session.amount_total ?? 0,
            totalPagadoCentavos: resumenPago.pagadoNetoCentavos,
            totalReservaCentavos,
            saldoPendienteCentavos: resumenPago.saldoPendienteCentavos,
            colorPrimario: propiedad.colorPrimario ?? undefined,
          });
        }
        if (cuentaCheckoutDirecto) await marcarIntentoPagoPagado(meta.roomlyIntentoId);
      } catch (err) {
        if ((err as { code?: string })?.code === "P2002") {
          return NextResponse.json({ received: true, duplicado: true });
        }
        if (err instanceof Error && ["SIN_DISPONIBILIDAD", "DATOS_RESERVA_INVALIDOS", "PAGO_STRIPE_INCONSISTENTE", "INTENTO_PAGO_NO_AUTORIZADO"].includes(err.message)) {
          const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
          if (piId) {
            if (cuentaCheckoutDirecto) {
              await reembolsarPagoDirectoHuesped(piId, cuentaCheckoutDirecto, undefined, `roomly-no-availability-${piId}`);
            } else {
              await reembolsarPagoHuesped(piId, undefined, `roomly-no-availability-${piId}`);
            }
          }
          return NextResponse.json({ received: true, reembolsado: true });
        }
        console.error("[webhook] GRUPO_ONLINE error:", err);
        throw err;
      }
    }

    if (session.metadata?.tipo === "MANUAL_PAGO" && session.metadata?.reservaId) {
      const reservaId = session.metadata.reservaId;
      const montoRecibido = (session.amount_total ?? 0) / 100;
      const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
      if (!piId) throw new Error("PAGO_STRIPE_INCONSISTENTE");

      const resultado = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${reservaId}, 19))`;
        const existente = await tx.pagoOnline.findUnique({ where: { stripePaymentIntentId: piId } });
        if (existente) return {
          existente,
          reserva: null,
          aplicado: false,
          montoReembolso: existente.estado === "REEMBOLSO_PENDIENTE" ? Number(existente.reembolsoPendienteMxn) : 0,
        };
        const reserva = await tx.reserva.findFirst({
          where: { id: reservaId, propiedadId: session.metadata!.propiedadId },
          include: {
            huesped: true,
            tipoDeHabitacion: true,
            propiedad: true,
            pagosOnline: true,
            pagosExternos: { include: { ajustes: true } },
          },
        });
        if (!reserva) throw new Error("RESERVA_INVALIDA");
        const pagoVencido = !puedeSolicitarPagoPorFecha({
          estado: reserva.estado,
          fechaSalida: reserva.fechaSalida,
          horaCheckOut: reserva.propiedad.horaCheckOut,
        });
        if (pagoVencido) {
          const pago = await tx.pagoOnline.create({
            data: {
              propiedadId: reserva.propiedadId,
              reservaId,
              stripePaymentIntentId: piId,
              stripeCheckoutSessionId: session.id,
              montoMxn: montoRecibido,
              moneda: session.currency ?? "mxn",
              modeloCobro: cuentaCheckoutDirecto ? "DIRECT" : "DESTINATION_LEGACY",
              stripeConnectAccountId: cuentaCheckoutDirecto,
              estado: "REEMBOLSO_PENDIENTE",
              reembolsoPendienteMxn: montoRecibido,
            },
          });
          return { existente: pago, reserva: null, aplicado: false, montoReembolso: montoRecibido };
        }
        const resumenAntes = calcularResumenFinanciero({
          totalReservaCentavos: aCentavos(Number(reserva.totalMxn)),
          pagosStripe: reserva.pagosOnline.map((pago) => ({
            cobradoCentavos: aCentavos(Number(pago.montoMxn)),
            reembolsadoCentavos: aCentavos(Number(pago.montoReembolsadoMxn)),
            reembolsoPendienteCentavos: aCentavos(Number(pago.reembolsoPendienteMxn)),
          })),
          pagosExternos: reserva.pagosExternos.map((pago) => ({
            cobradoCentavos: aCentavos(Number(pago.montoMxn)),
            ajustesCentavos: pago.ajustes.reduce(
              (total, ajuste) => total + aCentavos(Number(ajuste.montoMxn)),
              0
            ),
          })),
        });
        const restante = resumenAntes.saldoPendienteCentavos / 100;
        const montoAplicado = Math.min(restante, montoRecibido);
        const montoReembolso = Math.max(0, montoRecibido - montoAplicado);
        const pago = await tx.pagoOnline.create({
          data: {
            propiedadId: reserva.propiedadId,
            reservaId,
            stripePaymentIntentId: piId,
            stripeCheckoutSessionId: session.id,
            montoMxn: montoRecibido,
            moneda: session.currency ?? "mxn",
            modeloCobro: cuentaCheckoutDirecto ? "DIRECT" : "DESTINATION_LEGACY",
            stripeConnectAccountId: cuentaCheckoutDirecto,
            estado: montoReembolso > 0 ? "REEMBOLSO_PENDIENTE" : "PAGADO",
            reembolsoPendienteMxn: montoReembolso,
          },
        });
        await tx.reserva.update({
          where: { id: reservaId },
          data: {
            estado: EstadoReserva.CONFIRMADA,
            stripePaymentIntentId: piId,
          },
        });
        return { existente: pago, reserva, aplicado: montoAplicado > 0, montoReembolso };
      });

      if (resultado.montoReembolso > 0) {
        try {
          const centavosReembolso = Math.round(resultado.montoReembolso * 100);
          if (resultado.existente.stripeConnectAccountId) {
            await reembolsarPagoDirectoHuesped(piId, resultado.existente.stripeConnectAccountId, centavosReembolso, `roomly-refund-${resultado.existente.id}-${centavosReembolso}`);
          } else {
            await reembolsarPagoHuesped(piId, centavosReembolso, `roomly-refund-${resultado.existente.id}-${centavosReembolso}`);
          }
          const totalReembolsado = Number(resultado.existente.montoReembolsadoMxn) + resultado.montoReembolso;
          const esCompleto = totalReembolsado + 0.005 >= Number(resultado.existente.montoMxn);
          await prisma.pagoOnline.update({
            where: { id: resultado.existente.id },
            data: {
              estado: esCompleto ? "REEMBOLSADO" : "REEMBOLSADO_PARCIAL",
              montoReembolsadoMxn: totalReembolsado,
              reembolsoPendienteMxn: 0,
            },
          });
          return NextResponse.json({ received: true, reembolsado: true });
        } catch (err) {
          await prisma.pagoOnline.update({ where: { id: resultado.existente.id }, data: { estado: "REEMBOLSO_PENDIENTE" } });
          throw err;
        }
      }

      if (resultado.aplicado && resultado.reserva) {
        const reserva = await prisma.reserva.findFirst({
          where: { id: reservaId, propiedadId: session.metadata.propiedadId },
          include: {
            huesped: true,
            tipoDeHabitacion: true,
            propiedad: true,
            pagosOnline: true,
            pagosExternos: { include: { ajustes: true } },
          },
        });
        if (!reserva) throw new Error("RESERVA_INVALIDA");
        const totalReservaCentavos = aCentavos(Number(reserva.totalMxn));
        const resumenPago = calcularResumenFinanciero({
          totalReservaCentavos,
          pagosStripe: reserva.pagosOnline.map((pago) => ({
            cobradoCentavos: aCentavos(Number(pago.montoMxn)),
            reembolsadoCentavos: aCentavos(Number(pago.montoReembolsadoMxn)),
            reembolsoPendienteCentavos: aCentavos(Number(pago.reembolsoPendienteMxn)),
          })),
          pagosExternos: reserva.pagosExternos.map((pago) => ({
            cobradoCentavos: aCentavos(Number(pago.montoMxn)),
            ajustesCentavos: pago.ajustes.reduce(
              (total, ajuste) => total + aCentavos(Number(ajuste.montoMxn)),
              0
            ),
          })),
        });
        const datosReservaCorreo = {
          codigoReserva: reserva.codigoReserva,
          nombreHuesped: reserva.huesped.nombre,
          nombreHotel: reserva.propiedad.nombre,
          tipoHabitacion: reserva.tipoDeHabitacion.nombre,
          fechaIngreso: reserva.fechaIngreso,
          fechaSalida: reserva.fechaSalida,
          numPersonas: reserva.numPersonas,
          colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
        };

        Promise.allSettled([
          enviarComprobantePago({
            emailHuesped: reserva.huesped.email,
            ...datosReservaCorreo,
            montoRecibidoCentavos: session.amount_total ?? 0,
            totalPagadoCentavos: resumenPago.pagadoNetoCentavos,
            totalReservaCentavos,
            saldoPendienteCentavos: resumenPago.saldoPendienteCentavos,
          }),
          reserva.propiedad.email
            ? enviarAlertaEquipo({
                emailEquipo: reserva.propiedad.email,
                emailHuesped: reserva.huesped.email,
                telefonoHuesped: reserva.huesped.telefono ?? undefined,
                origen: "MANUAL",
                ...datosReservaCorreo,
                totalMxn: Number(reserva.totalMxn),
              })
            : Promise.resolve(),
        ]).catch(() => {});
      }
      if (cuentaCheckoutDirecto) await marcarIntentoPagoPagado(session.metadata.roomlyIntentoId);
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
