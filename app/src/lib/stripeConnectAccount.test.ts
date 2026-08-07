import { describe, expect, it } from "vitest";
import { cuentaConnectNecesitaReemplazo } from "./stripeConnectAccount";

describe("cuentaConnectNecesitaReemplazo", () => {
  it("reemplaza una cuenta guardada que Stripe reporta como inexistente", () => {
    expect(cuentaConnectNecesitaReemplazo({ code: "resource_missing", statusCode: 404 })).toBe(true);
  });

  it("no oculta errores transitorios de Stripe", () => {
    expect(cuentaConnectNecesitaReemplazo({ code: "api_error", statusCode: 500 })).toBe(false);
  });
});
