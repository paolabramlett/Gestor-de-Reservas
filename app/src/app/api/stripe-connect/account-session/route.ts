import { NextResponse } from "next/server";
import { getCurrentUsuario } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { evaluarAccesoConnect } from "@/lib/stripeConnectOnboarding";
import { obtenerOCrearCuentaConnect } from "@/lib/stripeConnectAccount.server";

export async function POST() {
  const usuario = await getCurrentUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const acceso = evaluarAccesoConnect(usuario.rol, usuario.propiedad.planActivo);
  if (!acceso.permitido) {
    return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  }

  try {
    const accountId = await obtenerOCrearCuentaConnect(usuario.propiedad);
    const session = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: {
          enabled: true,
          features: { external_account_collection: true },
        },
      },
    });

    return NextResponse.json(
      { clientSecret: session.client_secret },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[stripe-connect] account-session error:", error);
    return NextResponse.json(
      { error: "No pudimos iniciar la configuración de Stripe" },
      { status: 502 }
    );
  }
}
