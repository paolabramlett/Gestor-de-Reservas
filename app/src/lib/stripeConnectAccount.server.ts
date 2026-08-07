import "server-only";

import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import {
  cuentaConnectEsCompatible,
  cuentaConnectNecesitaReemplazo,
} from "@/lib/stripeConnectAccount";

type DatosPropiedadConnect = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  slug: string;
  stripeConnectAccountId: string | null;
};

export async function obtenerOCrearCuentaConnect(
  propiedad: DatosPropiedadConnect
): Promise<string> {
  if (propiedad.stripeConnectAccountId) {
    try {
      const cuenta = await stripe.accounts.retrieve(propiedad.stripeConnectAccountId);
      if (cuentaConnectEsCompatible(cuenta)) {
        return propiedad.stripeConnectAccountId;
      }
    } catch (error) {
      if (!cuentaConnectNecesitaReemplazo(error)) throw error;
    }
  }

  const account = await stripe.accounts.create(
    {
      country: "MX",
      email: propiedad.email || undefined,
      controller: {
        fees: { payer: "account" },
        losses: { payments: "stripe" },
        requirement_collection: "stripe",
        stripe_dashboard: { type: "full" },
      },
      business_profile: {
        name: propiedad.nombre,
        product_description: "Servicios de hospedaje",
        support_phone: propiedad.telefono || undefined,
        url: `https://hello-roomly.com/p/${propiedad.slug}`,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    },
    // Evita cuentas Express huérfanas si dos sesiones se solicitan al mismo tiempo.
    {
      idempotencyKey: propiedad.stripeConnectAccountId
        ? `roomly-connect-account-replacement-${propiedad.id}-${propiedad.stripeConnectAccountId}`
        : `roomly-connect-account-${propiedad.id}`,
    }
  );

  await prisma.propiedad.update({
    where: { id: propiedad.id },
    data: {
      stripeConnectAccountId: account.id,
      stripeConnectHabilitado: false,
    },
  });

  return account.id;
}
