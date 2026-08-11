import { describe, expect, it } from "vitest";
import { evaluarAccesoConnect, evaluarEstadoCuentaConnect } from "./stripeConnectOnboarding";

describe("evaluarAccesoConnect", () => {
  it("permite configurar pagos a administradores de una Propiedad con plan Pro", () => {
    expect(evaluarAccesoConnect("ADMIN", "PRO")).toEqual({ permitido: true });
    expect(evaluarAccesoConnect("SUPER_ADMIN", "PRO")).toEqual({ permitido: true });
  });

  it("rechaza roles no administrativos", () => {
    expect(evaluarAccesoConnect("RESERVACIONES", "PRO")).toEqual({
      permitido: false,
      status: 403,
      error: "Permisos insuficientes",
    });
  });

  it("rechaza Propiedades sin plan Pro", () => {
    expect(evaluarAccesoConnect("ADMIN", "ESENCIAL")).toEqual({
      permitido: false,
      status: 403,
      error: "Necesitas el plan Pro para configurar pagos con tarjeta",
    });
  });
});

describe("evaluarEstadoCuentaConnect", () => {
  it("solo habilita pagos cuando cobros y retiros están activos y no hay requisitos vencidos", () => {
    expect(evaluarEstadoCuentaConnect({
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      requirements: { currently_due: [], past_due: [], disabled_reason: null },
    })).toEqual({ habilitado: true, configurado: true });
  });

  it("no marca verde una cuenta que cobra pero no puede retirar por un documento vencido", () => {
    expect(evaluarEstadoCuentaConnect({
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      requirements: {
        currently_due: ["individual.verification.document"],
        past_due: ["individual.verification.document"],
        disabled_reason: "requirements.past_due",
      },
    })).toEqual({ habilitado: false, configurado: false });
  });
});
