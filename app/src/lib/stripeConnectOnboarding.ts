type AccesoConnect =
  | { permitido: true }
  | { permitido: false; status: 403; error: string };

export function evaluarAccesoConnect(rol: string, planActivo: string): AccesoConnect {
  if (rol !== "ADMIN" && rol !== "SUPER_ADMIN") {
    return { permitido: false, status: 403, error: "Permisos insuficientes" };
  }

  if (planActivo !== "PRO") {
    return {
      permitido: false,
      status: 403,
      error: "Necesitas el plan Pro para configurar pagos con tarjeta",
    };
  }

  return { permitido: true };
}
