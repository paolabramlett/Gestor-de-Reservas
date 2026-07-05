"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function iniciarCheckoutAction(formData: FormData) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const nombre = (formData.get("nombre") as string)?.trim();
  const slugInput = (formData.get("slug") as string)?.trim();
  const telefono = (formData.get("telefono") as string)?.trim() || "";
  const email = (formData.get("email") as string)?.trim() || "";
  const plan = (formData.get("plan") as string) === "PRO" ? "PRO" : "ESENCIAL";

  if (!nombre || nombre.length < 2) {
    redirect("/setup?error=nombre");
  }

  // Un usuario puede administrar varios hoteles, cada uno con su propia
  // suscripción — no bloqueamos por tener ya un hotel.
  const baseSlug = slugInput || generarSlug(nombre);
  let slug = baseSlug;
  let intento = 0;
  while (await prisma.propiedad.findUnique({ where: { slug } })) {
    intento++;
    slug = `${baseSlug}-${intento}`;
  }

  const priceId =
    plan === "PRO"
      ? process.env.STRIPE_PRICE_PRO!
      : process.env.STRIPE_PRICE_ESENCIAL!;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/setup/completar?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/setup?cancelado=1`,
    metadata: {
      tipo: "suscripcion_setup",
      clerkUserId: userId,
      hotelNombre: nombre,
      hotelSlug: slug,
      hotelTelefono: telefono,
      hotelEmail: email,
      plan,
    },
  });

  redirect(session.url!);
}
