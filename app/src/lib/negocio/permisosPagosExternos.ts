import { RolUsuario } from "@prisma/client";

const ROLES_ESCRITURA = new Set<RolUsuario>([
  RolUsuario.ADMIN,
  RolUsuario.SUPER_ADMIN,
  RolUsuario.RESERVACIONES,
]);

export const puedeMutarPagosExternos = (rol: RolUsuario): boolean => ROLES_ESCRITURA.has(rol);
