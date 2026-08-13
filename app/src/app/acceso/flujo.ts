type OpcionesCerrarSesion = {
  sessionId: string;
  redirectUrl: string;
};

export async function continuarAlInicioSesion(
  sessionId: string | null,
  cerrarSesion: (opciones: OpcionesCerrarSesion) => Promise<unknown>,
  abrirLogin: (ruta: string) => void
) {
  if (sessionId) {
    await cerrarSesion({ sessionId, redirectUrl: "/sign-in" });
    return;
  }

  abrirLogin("/sign-in");
}
