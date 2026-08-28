import { EstadoReserva } from "@prisma/client";
import { horaCheckInEsperada } from "./alertasCheckIn";
import { horaMexicoAUtc } from "./horaMexico";

export function limiteCheckout(fechaSalida: Date, horaCheckOut: string): Date {
  return horaMexicoAUtc(fechaSalida, horaCheckOut);
}

export function puedeSolicitarPagoPorFecha(input: {
  estado: EstadoReserva | string;
  fechaSalida: Date;
  horaCheckOut: string;
  ahora?: Date;
}): boolean {
  if (["CANCELADA", "NO_SHOW", "COMPLETADA"].includes(input.estado)) return false;
  return (input.ahora ?? new Date()) < limiteCheckout(input.fechaSalida, input.horaCheckOut);
}

export function debeMarcarNoShow(input: {
  estado: EstadoReserva | string;
  fechaIngreso: Date;
  horaCheckIn: string;
  horasParaNoShow: number;
  ahora?: Date;
}): boolean {
  if (input.estado !== "CONFIRMADA") return false;
  const umbral = horaCheckInEsperada(input.fechaIngreso, input.horaCheckIn);
  umbral.setTime(umbral.getTime() + input.horasParaNoShow * 60 * 60 * 1000);
  return (input.ahora ?? new Date()) >= umbral;
}
