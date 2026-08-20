import { RolUsuario } from "@prisma/client";

/** Roles que pueden consultar y operar Reservas, Calendario y Grupos. */
export const ROLES_GESTION_RESERVAS: RolUsuario[] = [
  RolUsuario.ADMIN,
  RolUsuario.SUPER_ADMIN,
  RolUsuario.RESERVACIONES,
];

export function puedeGestionarReservas(rol: RolUsuario): boolean {
  return ROLES_GESTION_RESERVAS.includes(rol);
}
