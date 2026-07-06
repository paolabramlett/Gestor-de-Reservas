import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// Stripe redirige aquí cuando el hotel termina (o abandona) el onboarding.
// Consultamos el estado real de la cuenta para dar feedback inmediato —
// el webhook account.updated sigue siendo la fuente de verdad a futuro.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  const propiedadId = req.nextUrl.searchParams.get("propiedadId");
  if (!propiedadId) return NextResponse.redirect(new URL("/panel/configuracion?tab=pagos", req.url));

  const pertenece = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId, propiedadId },
  });
  const propiedad = pertenece
    ? await prisma.propiedad.findUnique({ where: { id: propiedadId } })
    : null;

  if (!propiedad?.stripeConnectAccountId) {
    return NextResponse.redirect(new URL("/panel/configuracion?tab=pagos", req.url));
  }

  const account = await stripe.accounts.retrieve(propiedad.stripeConnectAccountId);

  await prisma.propiedad.update({
    where: { id: propiedadId },
    data: { stripeConnectHabilitado: !!account.charges_enabled },
  });

  const resultado = account.charges_enabled ? "conectado=1" : "pendiente=1";
  return NextResponse.redirect(new URL(`/panel/configuracion?tab=pagos&${resultado}`, req.url));
}
