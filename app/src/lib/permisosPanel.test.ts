import { describe, expect, it } from "vitest";
import { RolUsuario } from "@prisma/client";
import { puedeGestionarReservas } from "./permisosPanel";

describe("permisos de operación de reservas", () => {
  it.each([RolUsuario.ADMIN, RolUsuario.SUPER_ADMIN, RolUsuario.RESERVACIONES])(
    "permite operar a %s",
    (rol) => expect(puedeGestionarReservas(rol)).toBe(true)
  );

  it("mantiene FINANZAS como solo lectura fuera del módulo operativo", () => {
    expect(puedeGestionarReservas(RolUsuario.FINANZAS)).toBe(false);
  });
});
