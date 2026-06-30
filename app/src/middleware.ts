import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Solo correr Clerk en rutas del panel y auth.
// Portal (/p/*), /mi-reserva y /api/* son completamente públicos
// y no pasan por Clerk para evitar errores de sesión inválida.
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const esRutaClerk =
    pathname.startsWith("/panel") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up");

  if (esRutaClerk) {
    return clerkMiddleware(async (auth) => {
      if (pathname.startsWith("/panel")) {
        await auth.protect();
      }
    })(req, {} as never);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)).*)",
  ],
};
