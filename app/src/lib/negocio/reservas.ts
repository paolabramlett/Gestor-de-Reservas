import { prisma } from "@/lib/prisma";
import { Prisma, OrigenReserva, EstadoReserva, EstadoDePago, TipoEspecialReserva } from "@prisma/client";
import { ulid } from "ulid";
import { calcularTotalReserva } from "./tarifas";
import { bloquearInventarioTipo, verificarDisponibilidadAtómica } from "./disponibilidad";
import { enviarConfirmacion, enviarAlertaEquipo, enviarSolicitudPago } from "@/lib/emails";
import { stripe } from "@/lib/stripe";
import { crearClaveIdempotenciaDirectCharge, crearDirectCharge, requerirCuentaConectada } from "@/lib/stripeConnect";
import { resolverMontoCobro, resolverTotalReserva, validarDatosReserva, validarPagoManual } from "./reglasReserva";
import { validarCuentaConnectParaCobroDirecto } from "@/lib/stripeConnectAccount.server";
import { asociarIntentoPagoStripe, registrarIntentoPago } from "@/lib/negocio/intentosPago";

export function generarCodigoReserva(): string {
  const id = ulid();
  // Formato legible: RES-XXXX-XXXX (últimos 8 chars del ULID)
  return `RES-${id.slice(-8, -4)}-${id.slice(-4)}`;
}

type CrearReservaOnlineInput = {
  propiedadId: string;
  tipoDeHabitacionId: string;
  nombre: string;
  email: string;
  telefono?: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  numPersonas: number;
  stripePaymentIntentId: string;
  montoPagadoMxn: number;
  modeloCobro: "DIRECT" | "DESTINATION_LEGACY";
  stripeConnectAccountId: string | null;
};

export async function crearReservaOnline(input: CrearReservaOnlineInput) {
  const previa = await prisma.reserva.findUnique({
    where: { stripePaymentIntentId: input.stripePaymentIntentId },
    include: { huesped: true, tipoDeHabitacion: true, propiedad: true },
  });
  if (previa) return previa;
  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: input.tipoDeHabitacionId, propiedadId: input.propiedadId, activo: true },
    select: { capacidadMin: true, capacidadMax: true },
  });
  if (!tipo) throw new Error("TIPO_HABITACION_INVALIDO");
  validarDatosReserva(input.fechaIngreso, input.fechaSalida, input.numPersonas, tipo.capacidadMin, tipo.capacidadMax);
  const { desglose } = await calcularTotalReserva(
    input.tipoDeHabitacionId,
    input.fechaIngreso,
    input.fechaSalida,
    input.numPersonas
  );
  const totalCobrado = input.montoPagadoMxn;

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await bloquearInventarioTipo(tx, input.tipoDeHabitacionId);
    // Un reintento del mismo PaymentIntent debe devolver la Reserva existente
    // antes de recalcular disponibilidad, porque esa misma Reserva ya consume
    // la última Habitación y de otro modo se reembolsaría por error.
    const existente = await tx.reserva.findUnique({
      where: { stripePaymentIntentId: input.stripePaymentIntentId },
      include: { huesped: true, tipoDeHabitacion: true, propiedad: true },
    });
    if (existente) return existente;
    // Verificar disponibilidad dentro de la transacción
    const disponible = await verificarDisponibilidadAtómica(
      input.tipoDeHabitacionId,
      input.fechaIngreso,
      input.fechaSalida,
      tx
    );

    if (!disponible) {
      throw new Error("SIN_DISPONIBILIDAD");
    }

    // Cada reserva tiene su propio registro de huésped, aunque el correo se repita.
    // Así el nombre/teléfono de una reserva nunca afecta a otra que comparta email.
    const huesped = await tx.huesped.create({
      data: { nombre: input.nombre, email: input.email, telefono: input.telefono, propiedadId: input.propiedadId },
    });

    const reserva = await tx.reserva.create({
      data: {
        codigoReserva: generarCodigoReserva(),
        propiedadId: input.propiedadId,
        tipoDeHabitacionId: input.tipoDeHabitacionId,
        huespedId: huesped.id,
        nombreHuesped: input.nombre,
        origen: OrigenReserva.ONLINE,
        estado: EstadoReserva.CONFIRMADA,
        fechaIngreso: input.fechaIngreso,
        fechaSalida: input.fechaSalida,
        numPersonas: input.numPersonas,
        totalMxn: totalCobrado,
        desglosePorNoche: desglose,
        stripePaymentIntentId: input.stripePaymentIntentId,
      },
      include: { huesped: true, tipoDeHabitacion: true, propiedad: true },
    });
    await tx.pagoOnline.create({
      data: {
        propiedadId: input.propiedadId,
        reservaId: reserva.id,
        stripePaymentIntentId: input.stripePaymentIntentId,
        montoMxn: input.montoPagadoMxn,
        moneda: "mxn",
        modeloCobro: input.modeloCobro,
        stripeConnectAccountId: input.stripeConnectAccountId,
      },
    });
    return reserva;
  });
}

type CrearReservaManualInput = {
  propiedadId: string;
  tipoDeHabitacionId: string;
  nombre: string;
  email: string;
  telefono?: string;
  fechaIngreso: Date;
  fechaSalida: Date;
  numPersonas: number;
  estadoDePago?: EstadoDePago;
  montoAnticipo?: number | null;
  notas?: string;
  tipoEspecial?: TipoEspecialReserva | null;
  totalOverride?: number | null; // precio acordado por el usuario
};

export async function crearReservaManual(input: CrearReservaManualInput) {
  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: input.tipoDeHabitacionId, propiedadId: input.propiedadId },
    select: { capacidadMin: true, capacidadMax: true },
  });
  if (!tipo) throw new Error("TIPO_HABITACION_INVALIDO");
  validarDatosReserva(input.fechaIngreso, input.fechaSalida, input.numPersonas, tipo.capacidadMin, tipo.capacidadMax);
  const { total: totalCalculado, desglose } = await calcularTotalReserva(
    input.tipoDeHabitacionId,
    input.fechaIngreso,
    input.fechaSalida,
    input.numPersonas
  );

  // Si hay precio acordado/cortesía, usar ese total; si es cortesía sin precio, 0
  const total = resolverTotalReserva(totalCalculado, input.tipoEspecial, input.totalOverride);
  validarPagoManual(total, input.estadoDePago ?? EstadoDePago.PENDIENTE, input.montoAnticipo);

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await bloquearInventarioTipo(tx, input.tipoDeHabitacionId);
    // Mismo guard que las reservas online: recepción tampoco debe poder
    // crear dos reservas para el último cuarto sin darse cuenta.
    const disponible = await verificarDisponibilidadAtómica(
      input.tipoDeHabitacionId,
      input.fechaIngreso,
      input.fechaSalida,
      tx
    );
    if (!disponible) throw new Error("SIN_DISPONIBILIDAD");

    const emailNorm = input.email.toLowerCase().trim();
    // Cada reserva tiene su propio registro de huésped, aunque el correo se repita.
    const huesped = await tx.huesped.create({
      data: { nombre: input.nombre, email: emailNorm, telefono: input.telefono, propiedadId: input.propiedadId },
    });

    const reserva = await tx.reserva.create({
      data: {
        codigoReserva: generarCodigoReserva(),
        propiedadId: input.propiedadId,
        tipoDeHabitacionId: input.tipoDeHabitacionId,
        huespedId: huesped.id,
        nombreHuesped: input.nombre,
        origen: OrigenReserva.MANUAL,
        estado: EstadoReserva.CONFIRMADA,
        fechaIngreso: input.fechaIngreso,
        fechaSalida: input.fechaSalida,
        numPersonas: input.numPersonas,
        totalMxn: total,
        desglosePorNoche: desglose,
        tipoEspecial: input.tipoEspecial ?? null,
        pagoManual: {
          create: {
            estadoDePago: input.estadoDePago ?? EstadoDePago.PENDIENTE,
            montoAnticipo: input.montoAnticipo ?? null,
            notas: input.notas,
          },
        },
      },
      include: { huesped: true, tipoDeHabitacion: true, propiedad: true, pagoManual: true },
    });

    return reserva;
  }).then(async (reserva) => {
    // 11.5 + 11.8: emails confirmación y alerta equipo (fuera de la tx para no bloquearla)
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

    // El huésped solo recibe la confirmación cuando ya hay dinero de por
    // medio (anticipo o pago completo) — si queda "Pendiente" todavía no
    // hay nada que confirmarle. La alerta interna al equipo sí se manda
    // siempre, para que el hotel se entere de toda reserva manual nueva.
    const estadoDePago = reserva.pagoManual?.estadoDePago;
    const yaHayPago = estadoDePago === EstadoDePago.ANTICIPO_PAGADO || estadoDePago === EstadoDePago.PAGADO_COMPLETO;

    await Promise.allSettled([
      yaHayPago ? enviarConfirmacion({ emailHuesped: reserva.huesped.email, ...emailParams }) : Promise.resolve(),
      reserva.propiedad.email
        ? enviarAlertaEquipo({
            emailEquipo: reserva.propiedad.email,
            emailHuesped: reserva.huesped.email,
            telefonoHuesped: reserva.huesped.telefono ?? undefined,
            origen: "MANUAL",
            ...emailParams,
          })
        : Promise.resolve(),
    ]);

    return reserva;
  });
}

type CrearReservaConLinkInput = Omit<CrearReservaManualInput, "estadoDePago" | "montoAnticipo"> & {
  montoCobrar: number;
  esPagoCompleto: boolean;
  baseUrl: string;
};

export async function crearReservaConLinkDePago(input: CrearReservaConLinkInput) {
  // Validar Connect ANTES de crear la reserva — si el hotel no puede cobrar
  // todavía, no tiene sentido dejar una reserva huérfana en PENDIENTE_PAGO
  // que nunca se podrá pagar.
  const propiedadConnect = await prisma.propiedad.findUniqueOrThrow({
    where: { id: input.propiedadId },
    select: { stripeConnectAccountId: true, stripeConnectHabilitado: true },
  });
  requerirCuentaConectada(propiedadConnect);

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: input.tipoDeHabitacionId, propiedadId: input.propiedadId },
    select: { capacidadMin: true, capacidadMax: true },
  });
  if (!tipo) throw new Error("TIPO_HABITACION_INVALIDO");
  validarDatosReserva(input.fechaIngreso, input.fechaSalida, input.numPersonas, tipo.capacidadMin, tipo.capacidadMax);

  const { total: totalCalculado, desglose } = await calcularTotalReserva(
    input.tipoDeHabitacionId,
    input.fechaIngreso,
    input.fechaSalida,
    input.numPersonas
  );

  const total = resolverTotalReserva(totalCalculado, input.tipoEspecial, input.totalOverride);
  const montoCobrar = resolverMontoCobro(total, input.esPagoCompleto, input.montoCobrar);

  // Create reservation in PENDIENTE_PAGO state
  const reserva = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await bloquearInventarioTipo(tx, input.tipoDeHabitacionId);
    const disponible = await verificarDisponibilidadAtómica(
      input.tipoDeHabitacionId,
      input.fechaIngreso,
      input.fechaSalida,
      tx
    );
    if (!disponible) throw new Error("SIN_DISPONIBILIDAD");
    // Cada reserva tiene su propio registro de huésped, aunque el correo se repita.
    const huesped = await tx.huesped.create({
      data: { nombre: input.nombre, email: input.email, telefono: input.telefono, propiedadId: input.propiedadId },
    });

    const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const reserva = await tx.reserva.create({
      data: {
        codigoReserva: generarCodigoReserva(),
        propiedadId: input.propiedadId,
        tipoDeHabitacionId: input.tipoDeHabitacionId,
        huespedId: huesped.id,
        nombreHuesped: input.nombre,
        origen: OrigenReserva.MANUAL,
        estado: EstadoReserva.PENDIENTE_PAGO,
        fechaIngreso: input.fechaIngreso,
        fechaSalida: input.fechaSalida,
        numPersonas: input.numPersonas,
        totalMxn: total,
        desglosePorNoche: desglose,
        tipoEspecial: input.tipoEspecial ?? null,
        linkExpiraEn: expiraEn,
        pagoManual: {
          create: {
            estadoDePago: EstadoDePago.PENDIENTE,
            montoAnticipo: input.esPagoCompleto ? null : montoCobrar,
            notas: input.notas,
          },
        },
      },
      include: { huesped: true, tipoDeHabitacion: true, propiedad: true, pagoManual: true },
    });

    return reserva;
  });

  // Create Stripe Checkout Session
  let session;
  try {
    const directCharge = crearDirectCharge(propiedadConnect, montoCobrar);
    await validarCuentaConnectParaCobroDirecto(directCharge.stripeAccountId);
    const intentoPagoId = ulid();
    await registrarIntentoPago({
      intentoId: intentoPagoId,
      propiedadId: input.propiedadId,
      stripeConnectAccountId: directCharge.stripeAccountId,
      tipo: "MANUAL_PAGO",
      montoCentavos: Math.round(montoCobrar * 100),
      moneda: "mxn",
      datosReserva: { reservaId: reserva.id },
    });
    session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(montoCobrar * 100),
          product_data: {
            name: input.esPagoCompleto
              ? `Reserva completa — ${reserva.tipoDeHabitacion.nombre}`
              : `Anticipo de reserva — ${reserva.tipoDeHabitacion.nombre}`,
            description: `${reserva.codigoReserva} · ${reserva.propiedad.nombre}`,
          },
        },
      },
    ],
    customer_email: input.email,
    payment_intent_data: directCharge.paymentIntentData,
    metadata: {
      reservaId: reserva.id,
      tipo: "MANUAL_PAGO",
      esPagoCompleto: input.esPagoCompleto ? "true" : "false",
      propiedadId: input.propiedadId,
      montoEsperadoCentavos: String(Math.round(montoCobrar * 100)),
      moneda: "mxn",
      stripeConnectAccountId: directCharge.stripeAccountId,
      roomlyIntentoId: intentoPagoId,
    },
    expires_at: Math.floor((Date.now() + 24 * 60 * 60 * 1000) / 1000),
    success_url: `${input.baseUrl}/p/${reserva.propiedad.slug}/confirmacion?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.baseUrl}/p/${reserva.propiedad.slug}`,
    }, {
      ...directCharge.requestOptions,
      idempotencyKey: crearClaveIdempotenciaDirectCharge("reserva-manual", [reserva.id]),
    });
    await asociarIntentoPagoStripe(intentoPagoId, { stripeCheckoutSessionId: session.id });
    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { stripeCheckoutSessionId: session.id },
    });
  } catch (error) {
    if (session?.id) {
      await stripe.checkout.sessions.expire(
        session.id,
        {},
        { stripeAccount: propiedadConnect.stripeConnectAccountId! }
      ).catch(() => {});
    }
    await prisma.$transaction([
      prisma.reserva.delete({ where: { id: reserva.id } }),
      prisma.huesped.delete({ where: { id: reserva.huespedId } }),
    ]).catch(() => {});
    throw error;
  }

  // Send payment request email (fire-and-forget)
  enviarSolicitudPago({
    emailHuesped: input.email,
    codigoReserva: reserva.codigoReserva,
    nombreHuesped: input.nombre,
    nombreHotel: reserva.propiedad.nombre,
    tipoHabitacion: reserva.tipoDeHabitacion.nombre,
    fechaIngreso: reserva.fechaIngreso,
    fechaSalida: reserva.fechaSalida,
    numPersonas: reserva.numPersonas,
    montoCobrar,
    esPagoCompleto: input.esPagoCompleto,
    linkPago: session.url!,
    expiraEn: reserva.linkExpiraEn!,
    colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
  }).catch(() => {});

  return reserva;
}
