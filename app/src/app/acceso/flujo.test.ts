import { describe, expect, it, vi } from "vitest";
import { continuarAlInicioSesion } from "./flujo";

describe("acceso a una cuenta de Roomly", () => {
  it("cierra la sesión activa desde Clerk antes de abrir el login", async () => {
    const cerrarSesion = vi.fn().mockResolvedValue(undefined);
    const abrirLogin = vi.fn();

    await continuarAlInicioSesion("sess_residual", cerrarSesion, abrirLogin);

    expect(cerrarSesion).toHaveBeenCalledWith({
      sessionId: "sess_residual",
      redirectUrl: "/sign-in",
    });
    expect(abrirLogin).not.toHaveBeenCalled();
  });

  it("abre el login directamente cuando no existe una sesión", async () => {
    const cerrarSesion = vi.fn();
    const abrirLogin = vi.fn();

    await continuarAlInicioSesion(null, cerrarSesion, abrirLogin);

    expect(cerrarSesion).not.toHaveBeenCalled();
    expect(abrirLogin).toHaveBeenCalledWith("/sign-in");
  });
});
