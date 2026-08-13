import { describe, expect, it, vi } from "vitest";
import { crearEntradaInicioSesion } from "./route";

describe("entrada pública de inicio de sesión", () => {
  it("cierra una sesión residual antes de mostrar el formulario de acceso", async () => {
    const revocarSesion = vi.fn().mockResolvedValue(undefined);
    const POST = crearEntradaInicioSesion({
      obtenerSesionId: async () => "sess_residual",
      revocarSesion,
    });

    const respuesta = await POST(
      new Request("https://hello-roomly.com/api/auth/iniciar-sesion", {
        method: "POST",
      })
    );

    expect(revocarSesion).toHaveBeenCalledWith("sess_residual");
    expect(respuesta.status).toBe(303);
    expect(respuesta.headers.get("location")).toBe("https://hello-roomly.com/sign-in");
  });

  it("muestra el formulario directamente cuando no hay una sesión activa", async () => {
    const revocarSesion = vi.fn();
    const POST = crearEntradaInicioSesion({
      obtenerSesionId: async () => null,
      revocarSesion,
    });

    const respuesta = await POST(
      new Request("https://hello-roomly.com/api/auth/iniciar-sesion", {
        method: "POST",
      })
    );

    expect(revocarSesion).not.toHaveBeenCalled();
    expect(respuesta.status).toBe(303);
    expect(respuesta.headers.get("location")).toBe("https://hello-roomly.com/sign-in");
  });

  it("rechaza intentos de cerrar la sesión enviados desde otro sitio", async () => {
    const revocarSesion = vi.fn();
    const POST = crearEntradaInicioSesion({
      obtenerSesionId: async () => "sess_activa",
      revocarSesion,
    });

    const respuesta = await POST(
      new Request("https://hello-roomly.com/api/auth/iniciar-sesion", {
        method: "POST",
        headers: { origin: "https://sitio-ajeno.example" },
      })
    );

    expect(respuesta.status).toBe(403);
    expect(revocarSesion).not.toHaveBeenCalled();
  });
});
