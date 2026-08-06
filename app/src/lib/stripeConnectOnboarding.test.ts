import { describe, expect, it } from "vitest";
import { evaluarAccesoConnect } from "./stripeConnectOnboarding";

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
