"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearReservaManual, crearReservaConLinkDePago } from "@/lib/negocio/reservas";
import { EstadoDePago, EstadoReserva, TipoEspecialReserva } from "@prisma/client";
import { redirect } from "next/navigation";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { verificarDisponibilidadAtómica, verificarHabitacionLibre } from "@/lib/negocio/disponibilidad";
import { stripe } from "@/lib/stripe";
import { enviarSolicitudPago } from "@/lib/emails";

export async function crearReservaManualAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;
  const telefono = (formData.get("telefono") as string) || undefined;
  const fechaIngreso = new Date(formData.get("fechaIngreso") as string);
  const fechaSalida = new Date(formData.get("fechaSalida") as string);
  const numPersonas = Number(formData.get("numPersonas"));
  const estadoDePago = (formData.get("estadoDePago") as EstadoDePago) || EstadoDePago.PENDIENTE;
  const notas = (formData.get("notas") as string) || undefined;
  const from = formData.get("from") as string;
  const tipoEspecialRaw = formData.get("tipoEspecial") as string;
  const tipoEspecial = tipoEspecialRaw ? (tipoEspecialRaw as TipoEspecialReserva) : null;
  const montoAnticipoRaw = formData.get("montoAnticipo") as string;
  const montoAnticipo =
    estadoDePago === EstadoDePago.ANTICIPO_PAGADO && montoAnticipoRaw
      ? Number(montoAnticipoRaw)
      : null;
  const totalOverrideRaw = formData.get("totalOverride") as string;
  const totalOverride = totalOverrideRaw ? Number(totalOverrideRaw) : null;

  const reserva = await crearReservaManual({
    propiedadId: usuario.propiedadId,
    tipoDeHabitacionId,
    nombre,
    email,
    telefono,
    fechaIngreso,
    fechaSalida,
    numPersonas,
    estadoDePago,
    notas,
    tipoEspecial,
    montoAnticipo,
    totalOverride,
  });

  if (from === "calendario") {
    const mes = fechaIngreso.getMonth() + 1;
    const año = fechaIngreso.getFullYear();
    redirect(`/panel/calendario?mes=${mes}&año=${año}&success=${encodeURIComponent("Reserva creada")}`);
  }
  redirect(`/panel/reservas/${reserva.id}?success=${encodeURIComponent("Reserva creada")}`);
}

export async function crearReservaConPagoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;
  const telefono = (formData.get("telefono") as string) || undefined;
  const fechaIngreso = new Date(formData.get("fechaIngreso") as string);
  const fechaSalida = new Date(formData.get("fechaSalida") as string);
  const numPersonas = Number(formData.get("numPersonas"));
  const notas = (formData.get("notas") as string) || undefined;
  const from = formData.get("from") as string;
  const tipoEspecialRaw = formData.get("tipoEspecial") as string;
  const tipoEspecial = tipoEspecialRaw ? (tipoEspecialRaw as TipoEspecialReserva) : null;
  const totalOverrideRaw = formData.get("totalOverride") as string;
  const totalOverride = totalOverrideRaw ? Number(totalOverrideRaw) : null;
  const montoCobrar = Number(formData.get("montoCobrar") as string);
  const esPagoCompleto = formData.get("esPagoCompleto") === "true";

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const reserva = await crearReservaConLinkDePago({
    propiedadId: usuario.propiedadId,
    tipoDeHabitacionId,
    nombre,
    email,
    telefono,
    fechaIngreso,
    fechaSalida,
    numPersonas,
    notas,
    tipoEspecial,
    totalOverride,
    montoCobrar,
    esPagoCompleto,
    baseUrl,
  });

  if (from === "calendario") {
    const mes = fechaIngreso.getMonth() + 1;
    const año = fechaIngreso.getFullYear();
    redirect(`/panel/calendario?mes=${mes}&año=${año}&success=${encodeURIComponent("Link de pago enviado al huésped")}`);
  }
  redirect(`/panel/reservas/${reserva.id}?success=${encodeURIComponent("Link de pago enviado al huésped")}`);
}

export async function asignarHabitacionAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const habitacionId = formData.get("habitacionId") as string;

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
  });
  if (!reserva) throw new Error("Reserva no encontrada");

  let conflicto = false;
  await prisma.$transaction(async (tx) => {
    const libre = await verificarHabitacionLibre(
      habitacionId,
      reserva.fechaIngreso,
      reserva.fechaSalida,
      reservaId,
      tx
    );
    if (!libre) {
      conflicto = true;
      return;
    }
    await tx.asignacionDeHabitacion.upsert({
      where: { reservaId },
      update: { habitacionId },
      create: { reservaId, habitacionId },
    });
  });

  if (conflicto) {
    redirect(
      `/panel/reservas/${reservaId}?error=${encodeURIComponent("Esa habitación ya está ocupada o bloqueada en esas fechas")}`
    );
  }

  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Habitación asignada")}`);
}

export async function actualizarPagoYNotasAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const estadoDePago = formData.get("estadoDePago") as EstadoDePago;
  const notas = (formData.get("notas") as string) || undefined;
  const montoAnticipoRaw = formData.get("montoAnticipo") as string;
  const montoAnticipo =
    estadoDePago === EstadoDePago.ANTICIPO_PAGADO && montoAnticipoRaw
      ? Number(montoAnticipoRaw)
      : null;

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    include: { pagoManual: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");

  await prisma.pagoManual.upsert({
    where: { reservaId },
    update: { estadoDePago, notas, montoAnticipo },
    create: { reservaId, estadoDePago, notas, montoAnticipo },
  });

  redirect(`/panel/reservas/${reservaId}`);
}

export async function actualizarDatosReservaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const fechaIngreso = new Date(formData.get("fechaIngreso") as string);
  const fechaSalida = new Date(formData.get("fechaSalida") as string);
  const numPersonas = Number(formData.get("numPersonas"));
  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;
  const telefono = (formData.get("telefono") as string) || null;

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    include: { asignacion: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");

  // Validate tipo belongs to this propiedad
  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: tipoDeHabitacionId, propiedadId: usuario.propiedadId },
  });
  if (!tipo) redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("Tipo de habitación no válido")}`);

  if (fechaIngreso >= fechaSalida)
    redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("La fecha de salida debe ser posterior al ingreso")}`);

  const tipoChanged = tipoDeHabitacionId !== reserva.tipoDeHabitacionId;

  // Conflict check: only if same tipo AND same assigned room
  if (reserva.asignacion && !tipoChanged) {
    const conflicto = await prisma.reserva.findFirst({
      where: {
        id: { not: reservaId },
        estado: { notIn: ["CANCELADA", "NO_SHOW"] },
        asignacion: { habitacionId: reserva.asignacion.habitacionId },
        fechaIngreso: { lt: fechaSalida },
        fechaSalida: { gt: fechaIngreso },
      },
    });
    if (conflicto)
      redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("Las nuevas fechas entran en conflicto con otra reserva en la misma habitación")}`);
  }

  const totalOverrideRaw = formData.get("totalOverride") as string;
  const totalOverride = totalOverrideRaw ? Number(totalOverrideRaw) : null;

  let total: number;
  let desglose: unknown;

  if (reserva.tipoEspecial === "CORTESIA") {
    total = 0;
    desglose = {};
  } else if (
    (reserva.tipoEspecial === "PRECIO_ACORDADO" || reserva.tipoEspecial === "PROMOCION") &&
    totalOverride == null
  ) {
    // Keep existing agreed price if user didn't supply a new one
    total = Number(reserva.totalMxn);
    desglose = reserva.desglosePorNoche;
  } else if (totalOverride != null) {
    total = totalOverride;
    desglose = {};
  } else {
    const result = await calcularTotalReserva(tipoDeHabitacionId, fechaIngreso, fechaSalida, numPersonas);
    total = Number(result.total);
    desglose = result.desglose;
  }

  // Check if this huesped record is shared with other reservations
  const otrasReservasConMismoHuesped = await prisma.reserva.count({
    where: { huespedId: reserva.huespedId, id: { not: reservaId } },
  });

  await prisma.$transaction(async (tx) => {
    let huespedId = reserva.huespedId;

    if (otrasReservasConMismoHuesped > 0) {
      // Create a new huesped record to avoid affecting other reservations
      const nuevoHuesped = await tx.huesped.create({
        data: { nombre, email, telefono, propiedadId: usuario.propiedadId },
      });
      huespedId = nuevoHuesped.id;
    } else {
      await tx.huesped.update({
        where: { id: reserva.huespedId },
        data: { nombre, email, telefono },
      });
    }

    await tx.reserva.update({
      where: { id: reservaId },
      data: {
        tipoDeHabitacionId,
        fechaIngreso,
        fechaSalida,
        numPersonas,
        totalMxn: total,
        desglosePorNoche: desglose as import("@prisma/client").Prisma.InputJsonValue,
        huespedId,
      },
    });

    if (tipoChanged && reserva.asignacion) {
      await tx.asignacionDeHabitacion.delete({ where: { reservaId } });
    }
  });

  // BUG 12: mensaje correcto — esta acción actualiza datos de la reserva, no pagos
  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Datos actualizados")}`);
}

export async function actualizarEstadoReservaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const estado = formData.get("estado") as EstadoReserva;

  // BUG 13: prevenir transiciones desde estados terminales
  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
  });
  if (!reserva) redirect("/panel/reservas");

  const estadosTerminales: EstadoReserva[] = [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW, EstadoReserva.COMPLETADA];
  if (estadosTerminales.includes(reserva.estado)) {
    redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("No se puede modificar el estado de una reserva completada o cancelada")}`);
  }

  await prisma.reserva.update({
    where: { id: reservaId },
    data: { estado },
  });

  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Reserva actualizada")}`);
}

export async function solicitarPagoAction(reservaId: string) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    include: {
      huesped: true,
      tipoDeHabitacion: true,
      propiedad: true,
      pagoManual: true,
    },
  });

  if (!reserva) redirect(`/panel/reservas`);
  if (reserva.origen !== "MANUAL") redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("Solo aplica a reservas manuales")}`);
  if (reserva.tipoEspecial === "CORTESIA") redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("Las cortesías no requieren pago")}`);
  if (reserva.pagoManual?.estadoDePago === "PAGADO_COMPLETO") redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("Esta reserva ya está pagada por completo")}`);
  if (reserva.estado === "CANCELADA" || reserva.estado === "NO_SHOW" || reserva.estado === "COMPLETADA") {
    redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("No se puede solicitar pago en este estado")}`);
  }

  // BUG 4: calcular saldo real, no cobrar el total si ya hay un anticipo registrado
  const anticipoPagado =
    reserva.pagoManual?.estadoDePago === "ANTICIPO_PAGADO" && reserva.pagoManual.montoAnticipo
      ? Number(reserva.pagoManual.montoAnticipo)
      : 0;
  if (anticipoPagado > 0 && anticipoPagado >= Number(reserva.totalMxn)) {
    redirect(`/panel/reservas/${reservaId}?error=${encodeURIComponent("El anticipo registrado cubre el total — marca como Pagado completo")}`);
  }

  // Invalidar el Checkout Session anterior si existe
  if (reserva.stripeCheckoutSessionId) {
    try {
      await stripe.checkout.sessions.expire(reserva.stripeCheckoutSessionId);
    } catch {
      // Session ya expiró o fue completada — ignorar
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const montoCobrar = Number(reserva.totalMxn) - anticipoPagado;
  const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(montoCobrar * 100),
          product_data: {
            name: `Reserva completa — ${reserva.tipoDeHabitacion.nombre}`,
            description: `${reserva.codigoReserva} · ${reserva.propiedad.nombre}`,
          },
        },
      },
    ],
    customer_email: reserva.huesped.email,
    metadata: {
      reservaId: reserva.id,
      tipo: "MANUAL_PAGO",
      esPagoCompleto: "true",
    },
    expires_at: Math.floor(expiraEn.getTime() / 1000),
    success_url: `${baseUrl}/p/${reserva.propiedad.slug}/confirmacion?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/p/${reserva.propiedad.slug}`,
  });

  await prisma.reserva.update({
    where: { id: reserva.id },
    data: {
      stripeCheckoutSessionId: session.id,
      linkExpiraEn: expiraEn,
      estado: EstadoReserva.PENDIENTE_PAGO,
      pagoManual: {
        upsert: {
          create: { estadoDePago: EstadoDePago.PENDIENTE },
          update: {},
        },
      },
    },
  });

  enviarSolicitudPago({
    emailHuesped: reserva.huesped.email,
    codigoReserva: reserva.codigoReserva,
    nombreHuesped: reserva.huesped.nombre,
    nombreHotel: reserva.propiedad.nombre,
    tipoHabitacion: reserva.tipoDeHabitacion.nombre,
    fechaIngreso: reserva.fechaIngreso,
    fechaSalida: reserva.fechaSalida,
    numPersonas: reserva.numPersonas,
    montoCobrar,
    esPagoCompleto: true,
    linkPago: session.url!,
    expiraEn,
    colorPrimario: reserva.propiedad.colorPrimario ?? undefined,
  }).catch(() => {});

  redirect(`/panel/reservas/${reservaId}?success=${encodeURIComponent("Link de pago enviado al huésped")}`);
}

export async function calcularTotalPreviewAction(
  tipoDeHabitacionId: string,
  fechaIngreso: string,
  fechaSalida: string,
  numPersonas: number
): Promise<{ total: number; error?: string }> {
  try {
    const { total } = await calcularTotalReserva(
      tipoDeHabitacionId,
      new Date(fechaIngreso),
      new Date(fechaSalida),
      numPersonas
    );
    return { total: Number(total) };
  } catch {
    return { total: 0, error: "Error calculando tarifa" };
  }
}

export async function verificarDisponibilidadAction(
  tipoDeHabitacionId: string,
  fechaIngreso: string,
  fechaSalida: string
): Promise<{ disponible: boolean }> {
  const disponible = await verificarDisponibilidadAtómica(
    tipoDeHabitacionId,
    new Date(fechaIngreso),
    new Date(fechaSalida)
  );
  return { disponible };
}
