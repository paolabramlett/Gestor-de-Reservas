import { auth, clerkClient } from "@clerk/nextjs/server";

type DependenciasInicioSesion = {
  obtenerSesionId: () => Promise<string | null>;
  revocarSesion: (sessionId: string) => Promise<unknown>;
};

export function crearEntradaInicioSesion(dependencias: DependenciasInicioSesion) {
  return async function POST(req: Request) {
    const url = new URL(req.url);
    const origen = req.headers.get("origin");
    if (origen && origen !== url.origin) {
      return new Response("Origen no permitido", { status: 403 });
    }

    const sessionId = await dependencias.obtenerSesionId();

    if (sessionId) {
      await dependencias.revocarSesion(sessionId);
    }

    return Response.redirect(new URL("/sign-in", url), 303);
  };
}

export const POST = crearEntradaInicioSesion({
  obtenerSesionId: async () => (await auth()).sessionId,
  revocarSesion: async (sessionId) => {
    const clerk = await clerkClient();
    await clerk.sessions.revokeSession(sessionId);
  },
});
