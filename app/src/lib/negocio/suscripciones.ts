export type EstadoAccesoRoomly = {
  suscripcionActiva: boolean;
  accesoGratisLegacy: boolean;
};

export function tieneAccesoRoomly(estado: EstadoAccesoRoomly): boolean {
  return estado.suscripcionActiva || estado.accesoGratisLegacy;
}

export function puedeAdministrarSuscripcion(estado: Pick<EstadoAccesoRoomly, "accesoGratisLegacy">): boolean {
  return !estado.accesoGratisLegacy;
}
