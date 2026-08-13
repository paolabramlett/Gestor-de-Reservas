import { describe, expect, it, vi } from "vitest";
import { recuperarMembresiaLegacy } from "./recuperarMembresiaLegacy";

describe("recuperación de una membresía legacy", () => {
  it("transfiere la única membresía ADMIN obsoleta al usuario Live con correo verificado", async () => {
    const transferirMembresia = vi.fn().mockResolvedValue(undefined);

    const recuperada = await recuperarMembresiaLegacy(
      { clerkUserId: "user_live", emailVerificado: "paola@example.com" },
      {
        buscarPropiedadesLegacy: vi.fn().mockResolvedValue([
          {
            id: "propiedad_1",
            membresiasAdmin: [{ id: "membresia_1", clerkUserId: "user_test" }],
          },
        ]),
        usuarioExisteEnClerk: vi.fn().mockResolvedValue(false),
        transferirMembresia,
      }
    );

    expect(recuperada).toBe(true);
    expect(transferirMembresia).toHaveBeenCalledWith("membresia_1", "user_live");
  });

  it("no transfiere una membresía cuyo usuario todavía existe en Clerk Live", async () => {
    const transferirMembresia = vi.fn();

    const recuperada = await recuperarMembresiaLegacy(
      { clerkUserId: "user_live_nuevo", emailVerificado: "paola@example.com" },
      {
        buscarPropiedadesLegacy: vi.fn().mockResolvedValue([
          {
            id: "propiedad_1",
            membresiasAdmin: [{ id: "membresia_1", clerkUserId: "user_live_actual" }],
          },
        ]),
        usuarioExisteEnClerk: vi.fn().mockResolvedValue(true),
        transferirMembresia,
      }
    );

    expect(recuperada).toBe(false);
    expect(transferirMembresia).not.toHaveBeenCalled();
  });

  it("no usa correos sin verificar ni coincidencias ambiguas", async () => {
    const buscarPropiedadesLegacy = vi.fn().mockResolvedValue([]);
    const transferirMembresia = vi.fn();
    const dependencias = {
      buscarPropiedadesLegacy,
      usuarioExisteEnClerk: vi.fn(),
      transferirMembresia,
    };

    expect(
      await recuperarMembresiaLegacy(
        { clerkUserId: "user_live", emailVerificado: null },
        dependencias
      )
    ).toBe(false);
    expect(buscarPropiedadesLegacy).not.toHaveBeenCalled();

    buscarPropiedadesLegacy.mockResolvedValue([
      { id: "propiedad_1", membresiasAdmin: [] },
      { id: "propiedad_2", membresiasAdmin: [] },
    ]);
    expect(
      await recuperarMembresiaLegacy(
        { clerkUserId: "user_live", emailVerificado: "compartido@example.com" },
        dependencias
      )
    ).toBe(false);
    expect(transferirMembresia).not.toHaveBeenCalled();
  });
});
