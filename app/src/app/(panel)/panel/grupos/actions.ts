"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearReservaManual } from "@/lib/negocio/reservas";
import { EstadoDePago, EstadoReserva } from "@prisma/client";
import { redirect } from "next/navigation";
import { ulid } from "ulid";
import { stripe } from "@/lib/stripe";
import { enviarSolicitudPago } from "@/lib/emails";
import { headers } from "next/headers";

function generarCodigoGrupo(): string {
  const id = ulid();
  return `GRP-${id.slice(-8, -4)}-${id.slice(-4)}`;
}

// ── Crear grupo + todas las habitaciones en un solo submit ──────────────────

export type HabitacionInput = {
  tipoDeHabitacionId: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  nombre: string;
  email: string;
  telefono?: string;
  estadoDePago: EstadoDePago;
  notas?: string;
};

export async function crearGrupoConHabitacionesAction(
  nombre: string,
  notas: string,
  habitaciones: HabitacionInput[]
): Promise<{ ok: true; grupoId: string } | { ok: false; error: string }> {
  try {
    const usuario = await getCurrentUsuario();
    if (!usuario) return { ok: false, error: "No autenticado" };
    if (!nombre.trim()) return { ok: false, error: "El nombre del grupo es obligatorio" };
    if (habitaciones.length === 0) return { ok: false, error: "Agrega al menos una habitación" };

    const grupo = await prisma.grupoReserva.create({
      data: {
        propiedadId: usuario.propiedadId,
        codigoGrupo: generarCodigoGrupo(),
        nombre: nombre.trim(),
        notas: notas.trim() || null,
      },
    });

    for (let i = 0; i < habitaciones.length; i++) {
      const h = habitaciones[i];
      try {
        const reserva = await crearReservaManual({
          propiedadId: usuario.propiedadId,
          tipoDeHabitacionId: h.tipoDeHabitacionId,
          nombre: h.nombre,
          email: h.email,
          telefono: h.telefono || undefined,
          fechaIngreso: new Date(h.fechaIngreso),
          fechaSalida: new Date(h.fechaSalida),
          numPersonas: h.numPersonas,
          estadoDePago: h.estadoDePago,
          notas: h.notas || undefined,
        });

        await prisma.reserva.update({
          where: { id: reserva.id },
          data: { grupoId: grupo.id },
        });
      } catch (err: unknown) {
        // Si una habitación falla, elimina el grupo recién creado (y las reservas ya vinculadas)
        await prisma.reserva.updateMany({ where: { grupoId: grupo.id }, data: { grupoId: null } });
        await prisma.grupoReserva.delete({ where: { id: grupo.id } });

        const msg = err instanceof Error ? err.message : String(err);
        const label = `Habitación ${i + 1}`;
        if (msg === "SIN_DISPONIBILIDAD") {
          return { ok: false, error: `${label}: no hay disponibilidad para las fechas seleccionadas` };
        }
        return { ok: false, error: `${label}: ${msg}` };
      }
    }

    return { ok: true, grupoId: grupo.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error inesperado al crear el grupo";
    return { ok: false, error: msg };
  }
}

// ── Editar datos del grupo ──────────────────────────────────────────────────

export async function actualizarGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const grupoId = formData.get("grupoId") as string;
  const nombre = formData.get("nombre") as string;
  const notas = (formData.get("notas") as string) || null;

  await prisma.grupoReserva.updateMany({
    where: { id: grupoId, propiedadId: usuario.propiedadId },
    data: { nombre, notas },
  });

  redirect(`/panel/grupos/${grupoId}?success=${encodeURIComponent("Grupo actualizado")}`);
}

// ── Eliminar grupo (desvincula reservas, no las borra) ──────────────────────

export async function eliminarGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const grupoId = formData.get("grupoId") as string;

  await prisma.reserva.updateMany({
    where: { grupoId, propiedadId: usuario.propiedadId },
    data: { grupoId: null },
  });

  await prisma.grupoReserva.deleteMany({
    where: { id: grupoId, propiedadId: usuario.propiedadId },
  });

  redirect("/panel/grupos?success=" + encodeURIComponent("Grupo eliminado"));
}

// ── Agregar habitación a un grupo existente ─────────────────────────────────

export async function agregarHabitacionAlGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const grupoId = formData.get("grupoId") as string;

  const grupo = await prisma.grupoReserva.findFirst({
    where: { id: grupoId, propiedadId: usuario.propiedadId },
  });
  if (!grupo) redirect(`/panel/grupos/${grupoId}?error=${encodeURIComponent("Grupo no encontrado")}`);

  try {
    const reserva = await crearReservaManual({
      propiedadId: usuario.propiedadId,
      tipoDeHabitacionId: formData.get("tipoDeHabitacionId") as string,
      nombre: formData.get("nombre") as string,
      email: formData.get("email") as string,
      telefono: (formData.get("telefono") as string) || undefined,
      fechaIngreso: new Date(formData.get("fechaIngreso") as string),
      fechaSalida: new Date(formData.get("fechaSalida") as string),
      numPersonas: Number(formData.get("numPersonas")),
      estadoDePago: (formData.get("estadoDePago") as EstadoDePago) || EstadoDePago.PENDIENTE,
      notas: (formData.get("notas") as string) || undefined,
    });

    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { grupoId },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error && err.message === "SIN_DISPONIBILIDAD"
      ? "No hay disponibilidad para ese tipo y fechas"
      : err instanceof Error ? err.message : "Error al agregar la habitación";
    redirect(`/panel/grupos/${grupoId}?error=${encodeURIComponent(msg)}`);
  }

  redirect(`/panel/grupos/${grupoId}?success=${encodeURIComponent("Habitación agregada")}`);
}

// ── Vincular reserva existente por código ───────────────────────────────────

export async function vincularReservaAlGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const grupoId = formData.get("grupoId") as string;
  const codigoReserva = (formData.get("codigoReserva") as string).trim().toUpperCase();

  const reserva = await prisma.reserva.findFirst({
    where: { codigoReserva, propiedadId: usuario.propiedadId },
  });

  if (!reserva) {
    redirect(`/panel/grupos/${grupoId}?error=${encodeURIComponent("Reserva no encontrada")}`);
  }

  if (reserva.grupoId && reserva.grupoId !== grupoId) {
    redirect(`/panel/grupos/${grupoId}?error=${encodeURIComponent("Esa reserva ya pertenece a otro grupo")}`);
  }

  await prisma.reserva.update({
    where: { id: reserva.id },
    data: { grupoId },
  });

  redirect(`/panel/grupos/${grupoId}?success=${encodeURIComponent("Reserva vinculada")}`);
}

// ── Desvincular reserva del grupo ───────────────────────────────────────────

export async function desvincularReservaDelGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const grupoId = formData.get("grupoId") as string;

  await prisma.reserva.updateMany({
    where: { id: reservaId, propiedadId: usuario.propiedadId, grupoId },
    data: { grupoId: null },
  });

  redirect(`/panel/grupos/${grupoId}?success=${encodeURIComponent("Reserva desvinculada")}`);
}

// ── Solicitar pago del grupo ────────────────────────────────────────────────

export async function solicitarPagoGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const grupoId = formData.get("grupoId") as string;
  const montoRaw = formData.get("monto") as string;
  const esPagoCompleto = formData.get("esPagoCompleto") === "true";

  const monto = Number(montoRaw);
  if (!monto || monto <= 0) {
    redirect(`/panel/grupos/${grupoId}?error=${encodeURIComponent("Monto inválido")}`);
  }

  const grupo = await prisma.grupoReserva.findFirst({
    where: { id: grupoId, propiedadId: usuario.propiedadId },
    include: {
      propiedad: true,
      reservas: {
        where: { estado: { notIn: [EstadoReserva.CANCELADA, EstadoReserva.NO_SHOW] } },
        include: { huesped: true, tipoDeHabitacion: true },
        orderBy: { fechaIngreso: "asc" },
      },
    },
  });

  if (!grupo || grupo.reservas.length === 0) {
    redirect(`/panel/grupos/${grupoId}?error=${encodeURIComponent("Grupo sin reservas activas")}`);
  }

  const totalGrupo = grupo.reservas.reduce((s, r) => s + Number(r.totalMxn), 0);
  const totalPagado = Number(grupo.totalPagado);
  const restante = totalGrupo - totalPagado;

  if (restante <= 0) {
    redirect(`/panel/grupos/${grupoId}?error=${encodeURIComponent("El grupo ya está pagado completamente")}`);
  }

  if (monto > restante) {
    redirect(`/panel/grupos/${grupoId}?error=${encodeURIComponent(`El monto no puede superar el restante de $${restante.toLocaleString("es-MX")} MXN`)}`);
  }

  const contacto = grupo.reservas[0].huesped;
  const fechaMin = grupo.reservas.reduce(
    (min, r) => (r.fechaIngreso < min ? r.fechaIngreso : min),
    grupo.reservas[0].fechaIngreso
  );
  const fechaMax = grupo.reservas.reduce(
    (max, r) => (r.fechaSalida > max ? r.fechaSalida : max),
    grupo.reservas[0].fechaSalida
  );
  const totalPersonas = grupo.reservas.reduce((s, r) => s + r.numPersonas, 0);

  const headersList = await headers();
  const host = headersList.get("host") ?? "";
  const proto = host.includes("localhost") ? "http" : "https";
  const baseUrl = `${proto}://${host}`;

  const expiraEn = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(monto * 100),
          product_data: {
            name: esPagoCompleto
              ? `Pago completo — ${grupo.nombre}`
              : `Anticipo — ${grupo.nombre}`,
            description: `${grupo.codigoGrupo} · ${grupo.reservas.length} habitaciones · ${grupo.propiedad.nombre}`,
          },
        },
      },
    ],
    customer_email: contacto.email,
    metadata: {
      tipo: "GRUPO_PAGO",
      grupoId: grupo.id,
      esPagoCompleto: esPagoCompleto ? "true" : "false",
    },
    expires_at: Math.floor(expiraEn.getTime() / 1000),
    success_url: `${baseUrl}/p/${grupo.propiedad.slug}/pago-grupo-recibido`,
    cancel_url: `${baseUrl}/p/${grupo.propiedad.slug}`,
  });

  enviarSolicitudPago({
    emailHuesped: contacto.email,
    codigoReserva: grupo.codigoGrupo,
    nombreHuesped: contacto.nombre,
    nombreHotel: grupo.propiedad.nombre,
    tipoHabitacion: `${grupo.reservas.length} habitación${grupo.reservas.length !== 1 ? "es" : ""}`,
    fechaIngreso: fechaMin,
    fechaSalida: fechaMax,
    numPersonas: totalPersonas,
    montoCobrar: monto,
    esPagoCompleto,
    linkPago: session.url!,
    expiraEn,
    colorPrimario: grupo.propiedad.colorPrimario ?? undefined,
  }).catch(() => {});

  redirect(`/panel/grupos/${grupoId}?success=${encodeURIComponent(`Link de pago enviado a ${contacto.email}`)}`);
}
