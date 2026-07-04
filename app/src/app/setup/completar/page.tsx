import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { RolUsuario, PlanRoomly } from "@prisma/client";

function generarSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export default async function SetupCompletarPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { session_id } = await searchParams;
  if (!session_id) redirect("/setup");

  // Verify the Stripe checkout session
  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(session_id);
  } catch {
    redirect("/setup?error=pago");
  }

  if (session.status !== "complete") {
    redirect("/setup?error=pago");
  }

  const meta = session.metadata ?? {};

  // Security: this session must belong to the current user
  if (meta.clerkUserId !== userId) {
    redirect("/setup");
  }

  // Idempotency: if hotel already exists for this user, go to panel
  const yaExiste = await prisma.usuarioPropiedad.findFirst({
    where: { clerkUserId: userId },
  });
  if (yaExiste) redirect("/panel");

  // Resolve slug uniqueness (in case it was taken since checkout started)
  const baseSlug = meta.hotelSlug || generarSlug(meta.hotelNombre ?? "hotel");
  let slug = baseSlug;
  let intento = 0;
  while (await prisma.propiedad.findUnique({ where: { slug } })) {
    intento++;
    slug = `${baseSlug}-${intento}`;
  }

  try {
    await prisma.$transaction(async (tx) => {
    const p = await tx.propiedad.create({
      data: {
        clerkOrgId: userId,
        slug,
        nombre: meta.hotelNombre ?? "Mi Hotel",
        telefono: meta.hotelTelefono || null,
        email: meta.hotelEmail || null,
        stripeCustomerId: session.customer as string | null,
        stripeSubscriptionId: session.subscription as string | null,
        planActivo: meta.plan === "PRO" ? PlanRoomly.PRO : PlanRoomly.ESENCIAL,
        suscripcionActiva: true,
      },
    });
    await tx.usuarioPropiedad.create({
      data: {
        clerkUserId: userId,
        propiedadId: p.id,
        rol: RolUsuario.ADMIN,
      },
    });
    });
  } catch (err: unknown) {
    // Doble pestaña / recarga: el hotel ya se creó en otra request → al panel
    if ((err as { code?: string })?.code === "P2002") {
      redirect("/panel");
    }
    throw err;
  }

  redirect("/panel?setup=ok");
}
