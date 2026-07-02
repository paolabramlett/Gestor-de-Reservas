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

export async function crearGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const nombre = formData.get("nombre") as string;
  const notas = (formData.get("notas") as string) || null;

  const grupo = await prisma.grupoReserva.create({
    data: {
      propiedadId: usuario.propiedadId,
      codigoGrupo: generarCodigoGrupo(),
      nombre,
      notas,
    },
  });

  redirect(`/panel/grupos/${grupo.id}?success=${encodeURIComponent("Grupo creado")}`);
}

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

export async function eliminarGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const grupoId = formData.get("grupoId") as string;

  // Unlink reservations before deleting
  await prisma.reserva.updateMany({
    where: { grupoId, propiedadId: usuario.propiedadId },
    data: { grupoId: null },
  });

  await prisma.grupoReserva.deleteMany({
    where: { id: grupoId, propiedadId: usuario.propiedadId },
  });

  redirect("/panel/grupos?success=" + encodeURIComponent("Grupo eliminado"));
}

export async function agregarHabitacionAlGrupoAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const grupoId = formData.get("grupoId") as string;
  const tipoDeHabitacionId = formData.get("tipoDeHabitacionId") as string;
  const nombre = formData.get("nombre") as string;
  const email = formData.get("email") as string;
  const telefono = (formData.get("telefono") as string) || undefined;
  const fechaIngreso = new Date(formData.get("fechaIngreso") as string);
  const fechaSalida = new Date(formData.get("fechaSalida") as string);
  const numPersonas = Number(formData.get("numPersonas"));
  const estadoDePago = (formData.get("estadoDePago") as EstadoDePago) || EstadoDePago.PENDIENTE;
  const notas = (formData.get("notas") as string) || undefined;

  // Verify group belongs to this propiedad
  const grupo = await prisma.grupoReserva.findFirst({
    where: { id: grupoId, propiedadId: usuario.propiedadId },
  });
  if (!grupo) throw new Error("Grupo no encontrado");

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
  });

  // Link the new reservation to the group
  await prisma.reserva.update({
    where: { id: reserva.id },
    data: { grupoId },
  });

  redirect(`/panel/grupos/${grupoId}?success=${encodeURIComponent("Habitación agregada")}`);
}

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

  redirect(`/panel/grupos/${grupoId}?success=${encodeURIComponent("Reserva vinculada al grupo")}`);
}

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
