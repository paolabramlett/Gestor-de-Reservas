import { NextResponse } from "next/server";
import { getCurrentUsuario } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import {
  evaluarAccesoConnect,
  evaluarEstadoCuentaConnect,
} from "@/lib/stripeConnectOnboarding";

export async function POST() {
  const usuario = await getCurrentUsuario();
  if (!usuario) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const acceso = evaluarAccesoConnect(usuario.rol, usuario.propiedad.planActivo);
  if (!acceso.permitido) {
    return NextResponse.json({ error: acceso.error }, { status: acceso.status });
  }

  const accountId = usuario.propiedad.stripeConnectAccountId;
  if (!accountId) {
    return NextResponse.json({ habilitado: false, configurado: false });
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);
    const estado = evaluarEstadoCuentaConnect(account);

    await prisma.propiedad.update({
      where: { id: usuario.propiedadId },
      data: { stripeConnectHabilitado: estado.habilitado },
    });

    return NextResponse.json(estado);
  } catch (error) {
    console.error("[stripe-connect] status error:", error);
    return NextResponse.json(
      { error: "No pudimos consultar el estado de Stripe" },
      { status: 502 }
    );
  }
}
