import { RolUsuario } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { puedeMutarPagosExternos } from "./permisosPagosExternos";

describe("puedeMutarPagosExternos", () => {
  it.each(["ADMIN", "SUPER_ADMIN", "RESERVACIONES"])("permite mutar a %s", (rol) => {
    expect(puedeMutarPagosExternos(rol as RolUsuario)).toBe(true);
  });

  it("Finanzas es solo lectura", () => {
    expect(puedeMutarPagosExternos(RolUsuario.FINANZAS)).toBe(false);
  });
});
