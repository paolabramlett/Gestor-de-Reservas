import { describe, expect, it } from "vitest";
import { cuentaConnectNecesitaReemplazo, esPlataformaConnectNoConfigurada } from "./stripeConnectAccount";

describe("cuentaConnectNecesitaReemplazo", () => {
  it("reemplaza una cuenta guardada que Stripe reporta como inexistente", () => {
    expect(cuentaConnectNecesitaReemplazo({ code: "resource_missing", statusCode: 404 })).toBe(true);
  });

  it("no oculta errores transitorios de Stripe", () => {
    expect(cuentaConnectNecesitaReemplazo({ code: "api_error", statusCode: 500 })).toBe(false);
  });
});

describe("esPlataformaConnectNoConfigurada", () => {
  it("reconoce el error de una cuenta Stripe que todavía no es plataforma Connect", () => {
    expect(esPlataformaConnectNoConfigurada({ code: "platform_account_required", statusCode: 403 })).toBe(true);
  });
});
