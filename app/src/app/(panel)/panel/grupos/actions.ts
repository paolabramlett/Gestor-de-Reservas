"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearReservaManual } from "@/lib/negocio/reservas";
import { EstadoDePago } from "@prisma/client";
import { redirect } from "next/navigation";
import { ulid } from "ulid";

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

  for (const h of habitaciones) {
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
  }

  return { ok: true, grupoId: grupo.id };
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
  if (!grupo) throw new Error("Grupo no encontrado");

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
