import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Stripe redirige aquí si el link de onboarding expiró a medio proceso.
// Generamos uno nuevo y lo mandamos de vuelta, sin que el hotel tenga que
// hacer nada distinto.
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

  const accountLink = await stripe.accountLinks.create({
    account: propiedad.stripeConnectAccountId,
    refresh_url: `${appUrl}/api/stripe-connect/refresh?propiedadId=${propiedadId}`,
    return_url: `${appUrl}/api/stripe-connect/return?propiedadId=${propiedadId}`,
    type: "account_onboarding",
  });

  return NextResponse.redirect(accountLink.url);
}
