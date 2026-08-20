import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/negocio/pagosOnline", () => ({ reembolsarPagosOnline: vi.fn() }));
vi.mock("@/lib/emails", () => ({ enviarCancelacion: vi.fn() }));

import { tieneEliminacionSegura } from "./cicloDeVida";

describe("tieneEliminacionSegura", () => {
  it("permite borrar únicamente cuando no existe ningún movimiento financiero", () => {
    expect(tieneEliminacionSegura({
      tienePagosStripe: false,
      tienePagosExternos: false,
      grupoPagadoCentavos: 0,
    })).toBe(true);
  });
});
