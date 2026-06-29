"use server";

import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { crearReservaManual } from "@/lib/negocio/reservas";
import { EstadoDePago, EstadoReserva } from "@prisma/client";
import { redirect } from "next/navigation";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { verificarDisponibilidadAtómica } from "@/lib/negocio/disponibilidad";

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

  redirect(`/panel/reservas/${reserva.id}`);
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

  await prisma.asignacionDeHabitacion.upsert({
    where: { reservaId },
    update: { habitacionId },
    create: { reservaId, habitacionId },
  });

  redirect(`/panel/reservas/${reservaId}`);
}

export async function actualizarPagoYNotasAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const estadoDePago = formData.get("estadoDePago") as EstadoDePago;
  const notas = (formData.get("notas") as string) || undefined;

  const reserva = await prisma.reserva.findFirst({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    include: { pagoManual: true },
  });
  if (!reserva) throw new Error("Reserva no encontrada");

  await prisma.pagoManual.upsert({
    where: { reservaId },
    update: { estadoDePago, notas },
    create: { reservaId, estadoDePago, notas },
  });

  redirect(`/panel/reservas/${reservaId}`);
}

export async function actualizarEstadoReservaAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const reservaId = formData.get("reservaId") as string;
  const estado = formData.get("estado") as EstadoReserva;

  await prisma.reserva.updateMany({
    where: { id: reservaId, propiedadId: usuario.propiedadId },
    data: { estado },
  });

  redirect(`/panel/reservas/${reservaId}`);
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
