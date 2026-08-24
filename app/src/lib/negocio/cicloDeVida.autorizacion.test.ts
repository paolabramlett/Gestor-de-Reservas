import { describe, expect, it } from "vitest";
import { RolUsuario } from "@prisma/client";
import { puedeAutorizarSaldoPendiente } from "./cicloDeVida";

describe("autorización administrativa de check-in", () => {
  it("solo permite Admin y Super Admin", () => {
    expect(puedeAutorizarSaldoPendiente(RolUsuario.ADMIN)).toBe(true);
    expect(puedeAutorizarSaldoPendiente(RolUsuario.SUPER_ADMIN)).toBe(true);
    expect(puedeAutorizarSaldoPendiente(RolUsuario.RESERVACIONES)).toBe(false);
    expect(puedeAutorizarSaldoPendiente(RolUsuario.FINANZAS)).toBe(false);
  });
});
