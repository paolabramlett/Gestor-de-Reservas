"use server";

import { getCurrentUsuario, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { PlanRoomly } from "@prisma/client";

function priceIdParaPlan(plan: PlanRoomly): string {
  return plan === PlanRoomly.PRO
    ? process.env.STRIPE_PRICE_PRO!
    : process.env.STRIPE_PRICE_ESENCIAL!;
}

// Extrae el fin de periodo actual de una suscripción de Stripe. En API
// versions recientes, current_period_end vive en cada subscription item
// (no en el objeto de suscripción); mantenemos un fallback por si acaso.
function finDePeriodoDe(subscription: {
  current_period_end?: number;
  items: { data: { current_period_end?: number }[] };
}): Date | null {
  const ts = subscription.items.data[0]?.current_period_end ?? subscription.current_period_end;
  return ts ? new Date(ts * 1000) : null;
}

export async function cambiarPlanAction(formData: FormData) {
  const usuario = await requireAdmin();
  const nuevoPlan = formData.get("plan") as PlanRoomly;

  const propiedad = await prisma.propiedad.findUniqueOrThrow({
    where: { id: usuario.propiedadId },
  });

  if (!propiedad.stripeSubscriptionId) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("No encontramos una suscripción activa. Contáctanos."));
  }
  if (propiedad.planActivo === nuevoPlan) {
    redirect("/panel/configuracion?guardado=1");
  }

  const subscription = await stripe.subscriptions.retrieve(propiedad.stripeSubscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("No pudimos leer tu suscripción. Contáctanos."));
  }

  const actualizada = await stripe.subscriptions.update(propiedad.stripeSubscriptionId, {
    items: [{ id: itemId, price: priceIdParaPlan(nuevoPlan) }],
    proration_behavior: "create_prorations",
  });

  await prisma.propiedad.update({
    where: { id: propiedad.id },
    data: {
      planActivo: nuevoPlan,
      suscripcionActiva: actualizada.status === "active" || actualizada.status === "trialing",
      canceladaAlFinalDePeriodo: actualizada.cancel_at_period_end,
      finDePeriodoActual: finDePeriodoDe(actualizada),
    },
  });

  redirect(
    `/panel/configuracion?guardado=1&plan=${nuevoPlan === "PRO" ? "pro" : "esencial"}`
  );
}

export async function cancelarSuscripcionAction() {
  const usuario = await requireAdmin();

  const propiedad = await prisma.propiedad.findUniqueOrThrow({
    where: { id: usuario.propiedadId },
  });
  if (!propiedad.stripeSubscriptionId) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("No encontramos una suscripción activa."));
  }

  const actualizada = await stripe.subscriptions.update(propiedad.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await prisma.propiedad.update({
    where: { id: propiedad.id },
    data: {
      canceladaAlFinalDePeriodo: true,
      finDePeriodoActual: finDePeriodoDe(actualizada),
    },
  });

  redirect("/panel/configuracion?cancelada=1");
}

export async function reactivarSuscripcionAction() {
  const usuario = await requireAdmin();

  const propiedad = await prisma.propiedad.findUniqueOrThrow({
    where: { id: usuario.propiedadId },
  });
  if (!propiedad.stripeSubscriptionId) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("No encontramos una suscripción activa."));
  }

  await stripe.subscriptions.update(propiedad.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await prisma.propiedad.update({
    where: { id: propiedad.id },
    data: { canceladaAlFinalDePeriodo: false, finDePeriodoActual: null },
  });

  redirect("/panel/configuracion?reactivada=1");
}

export async function actualizarPropiedadAction(formData: FormData) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  await prisma.propiedad.update({
    where: { id: usuario.propiedadId },
    data: {
      nombre: formData.get("nombre") as string,
      descripcion: (formData.get("descripcion") as string) || null,
      telefono: (formData.get("telefono") as string) || null,
      email: (formData.get("email") as string) || null,
      direccion: (formData.get("direccion") as string) || null,
      colorPrimario: (formData.get("colorPrimario") as string) || null,
      logoUrl: (formData.get("logoUrl") as string) || null,
    },
  });

  redirect("/panel/configuracion?guardado=1");
}
