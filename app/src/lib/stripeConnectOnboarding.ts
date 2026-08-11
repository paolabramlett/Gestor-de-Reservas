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

type CuentaConnectEstado = {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    disabled_reason?: string | null;
  } | null;
};

export function evaluarEstadoCuentaConnect(cuenta: CuentaConnectEstado): {
  habilitado: boolean;
  configurado: boolean;
} {
  const requirements = cuenta.requirements;
  const sinRequisitosPendientes =
    (requirements?.currently_due?.length ?? 0) === 0 &&
    (requirements?.past_due?.length ?? 0) === 0 &&
    !requirements?.disabled_reason;
  const habilitado =
    cuenta.charges_enabled === true &&
    cuenta.payouts_enabled === true &&
    cuenta.details_submitted === true &&
    sinRequisitosPendientes;

  return { habilitado, configurado: habilitado };
}
