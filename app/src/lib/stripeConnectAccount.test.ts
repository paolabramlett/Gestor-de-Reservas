import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeAccounts = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
}));
const propiedadUpdate = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { propiedad: { update: propiedadUpdate } },
}));
vi.mock("@/lib/stripe", () => ({
  stripe: { accounts: stripeAccounts },
}));
import {
  cuentaConnectEsCompatible,
  cuentaConnectPuedeCobrarSinRiesgoPlataforma,
  cuentaConnectNecesitaReemplazo,
  cuentaConnectUsaDashboardCompleto,
  esPlataformaConnectNoConfigurada,
} from "./stripeConnectAccount";
import { obtenerOCrearCuentaConnect } from "./stripeConnectAccount.server";

const propiedad = {
  id: "prop_123",
  nombre: "Casa Canteras",
  email: "reservas@casacanteras.mx",
  telefono: "+525555555555",
  slug: "casa-canteras",
  stripeConnectAccountId: "acct_express",
};

beforeEach(() => {
  stripeAccounts.create.mockReset();
  stripeAccounts.retrieve.mockReset();
  propiedadUpdate.mockReset();
});

describe("cuentaConnectEsCompatible", () => {
  it("reutiliza una cuenta cuando Stripe cobra al hotel, asume sus pérdidas y le da dashboard completo", () => {
    expect(
      cuentaConnectEsCompatible({
        controller: {
          fees: { payer: "account" },
          losses: { payments: "stripe" },
          requirement_collection: "stripe",
          stripe_dashboard: { type: "full" },
        },
      })
    ).toBe(true);
  });

  it("rechaza una cuenta Express aunque esté habilitada", () => {
    expect(
      cuentaConnectEsCompatible({
        controller: {
          fees: { payer: "application_express" },
          losses: { payments: "application" },
          requirement_collection: "stripe",
          stripe_dashboard: { type: "express" },
        },
      })
    ).toBe(false);
  });
});

describe("cuentaConnectPuedeCobrarSinRiesgoPlataforma", () => {
  const segura = {
    charges_enabled: true,
    capabilities: { card_payments: "active" },
    controller: {
      fees: { payer: "account" },
      losses: { payments: "stripe" },
      requirement_collection: "stripe",
      stripe_dashboard: { type: "full" },
    },
  };

  it("acepta solo una cuenta habilitada donde Stripe y el hotel asumen el cobro", () => {
    expect(cuentaConnectPuedeCobrarSinRiesgoPlataforma(segura)).toBe(true);
  });

  it.each([
    { ...segura, charges_enabled: false },
    { ...segura, capabilities: { card_payments: "inactive" } },
    { ...segura, controller: { ...segura.controller, fees: { payer: "application" } } },
    { ...segura, controller: { ...segura.controller, losses: { payments: "application" } } },
  ])("bloquea cualquier desviación de responsabilidades", (cuenta) => {
    expect(cuentaConnectPuedeCobrarSinRiesgoPlataforma(cuenta)).toBe(false);
  });
});

describe("cuentaConnectUsaDashboardCompleto", () => {
  it("distingue las cuentas full que deben usar el login normal de Stripe", () => {
    expect(cuentaConnectUsaDashboardCompleto({
      controller: { stripe_dashboard: { type: "full" } },
    })).toBe(true);
    expect(cuentaConnectUsaDashboardCompleto({
      controller: { stripe_dashboard: { type: "express" } },
    })).toBe(false);
  });
});

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

describe("obtenerOCrearCuentaConnect", () => {
  it("reutiliza una cuenta existente que ya tiene las responsabilidades requeridas", async () => {
    stripeAccounts.retrieve.mockResolvedValue({
      controller: {
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "full" },
      },
    });

    await expect(obtenerOCrearCuentaConnect(propiedad)).resolves.toBe("acct_express");

    expect(stripeAccounts.create).not.toHaveBeenCalled();
    expect(propiedadUpdate).not.toHaveBeenCalled();
  });

  it("sustituye una cuenta Express incompatible por una cuenta configurada para el hotel", async () => {
    stripeAccounts.retrieve.mockResolvedValue({
      controller: {
        fees: { payer: "application_express" },
        losses: { payments: "application" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "express" },
      },
    });
    stripeAccounts.create.mockResolvedValue({ id: "acct_reemplazo" });
    propiedadUpdate.mockResolvedValue({});

    await expect(obtenerOCrearCuentaConnect(propiedad)).resolves.toBe("acct_reemplazo");

    expect(stripeAccounts.create).toHaveBeenCalledOnce();
    expect(propiedadUpdate).toHaveBeenCalledWith({
      where: { id: "prop_123" },
      data: {
        stripeConnectAccountId: "acct_reemplazo",
        stripeConnectHabilitado: false,
      },
    });
  });

  it("crea cuentas nuevas con Stripe y el hotel como responsables configurados", async () => {
    stripeAccounts.create.mockResolvedValue({ id: "acct_nueva" });
    propiedadUpdate.mockResolvedValue({});

    await expect(
      obtenerOCrearCuentaConnect({ ...propiedad, stripeConnectAccountId: null })
    ).resolves.toBe("acct_nueva");

    expect(stripeAccounts.create).toHaveBeenCalledWith(
      {
        country: "MX",
        email: "reservas@casacanteras.mx",
        controller: {
          fees: { payer: "account" },
          losses: { payments: "stripe" },
          requirement_collection: "stripe",
          stripe_dashboard: { type: "full" },
        },
        business_profile: {
          name: "Casa Canteras",
          product_description: "Servicios de hospedaje",
          support_phone: "+525555555555",
          url: "https://hello-roomly.com/p/casa-canteras",
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      },
      { idempotencyKey: "roomly-connect-account-prop_123" }
    );
  });

  it("sustituye una cuenta eliminada en Stripe con una clave idempotente de reemplazo", async () => {
    stripeAccounts.retrieve.mockRejectedValue({ code: "resource_missing", statusCode: 404 });
    stripeAccounts.create.mockResolvedValue({ id: "acct_reemplazo" });
    propiedadUpdate.mockResolvedValue({});

    await expect(obtenerOCrearCuentaConnect(propiedad)).resolves.toBe("acct_reemplazo");

    expect(stripeAccounts.create).toHaveBeenLastCalledWith(
      expect.any(Object),
      {
        idempotencyKey: "roomly-connect-account-replacement-prop_123-acct_express",
      }
    );
  });
});
