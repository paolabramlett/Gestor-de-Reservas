"use server";

import { getCurrentUsuario, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { PlanRoomly, RolUsuario } from "@prisma/client";
import { enviarInvitacionEquipo } from "@/lib/emails";

const ROLES_INVITABLES: RolUsuario[] = [RolUsuario.ADMIN, RolUsuario.RESERVACIONES, RolUsuario.FINANZAS];

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

// ── Horarios ─────────────────────────────────────────────────────────────────

function validarHora(valor: string | null, fallback: string): string {
  return valor && /^([01]\d|2[0-3]):[0-5]\d$/.test(valor) ? valor : fallback;
}

export async function actualizarHorariosAction(formData: FormData) {
  const usuario = await requireAdmin();

  const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: usuario.propiedadId } });

  const horaCheckIn = validarHora(formData.get("horaCheckIn") as string, propiedad.horaCheckIn);
  const horaCheckOut = validarHora(formData.get("horaCheckOut") as string, propiedad.horaCheckOut);
  const horasParaLateCheckIn = Math.max(0, Number(formData.get("horasParaLateCheckIn")) || 0);
  const horasParaNoShow = Math.max(horasParaLateCheckIn, Number(formData.get("horasParaNoShow")) || 0);
  const costoLateCheckInRaw = formData.get("costoLateCheckIn") as string;
  const costoLateCheckIn = costoLateCheckInRaw ? Number(costoLateCheckInRaw) : null;

  await prisma.propiedad.update({
    where: { id: usuario.propiedadId },
    data: {
      horaCheckIn,
      horaCheckOut,
      horasParaLateCheckIn,
      horasParaNoShow,
      costoLateCheckIn,
    },
  });

  redirect("/panel/configuracion?guardado=1&tab=horarios");
}

// ── Equipo ───────────────────────────────────────────────────────────────────

export async function enviarInvitacionAction(formData: FormData) {
  const usuario = await requireAdmin();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const rol = formData.get("rol") as RolUsuario;

  if (!email || !ROLES_INVITABLES.includes(rol)) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("Correo o rol inválido"));
  }

  const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: usuario.propiedadId } });

  const invitacionPendiente = await prisma.invitacionEquipo.findFirst({
    where: {
      propiedadId: usuario.propiedadId,
      email,
      aceptadaEn: null,
      canceladaEn: null,
      expiraEn: { gt: new Date() },
    },
  });
  if (invitacionPendiente) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("Ya existe una invitación pendiente para ese correo"));
  }

  const expiraEn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invitacion = await prisma.invitacionEquipo.create({
    data: { propiedadId: usuario.propiedadId, email, rol, expiraEn },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await enviarInvitacionEquipo({
    email,
    nombreHotel: propiedad.nombre,
    rol,
    linkInvitacion: `${appUrl}/invitacion/${invitacion.token}`,
    expiraEn,
    colorPrimario: propiedad.colorPrimario ?? undefined,
  });

  redirect("/panel/configuracion?invitado=1");
}

export async function cancelarInvitacionAction(formData: FormData) {
  const usuario = await requireAdmin();
  const invitacionId = formData.get("invitacionId") as string;

  await prisma.invitacionEquipo.updateMany({
    where: { id: invitacionId, propiedadId: usuario.propiedadId, aceptadaEn: null },
    data: { canceladaEn: new Date() },
  });

  redirect("/panel/configuracion?invitacionCancelada=1");
}

export async function actualizarRolUsuarioAction(formData: FormData) {
  const usuario = await requireAdmin();
  const usuarioPropiedadId = formData.get("usuarioPropiedadId") as string;
  const nuevoRol = formData.get("rol") as RolUsuario;

  if (!ROLES_INVITABLES.includes(nuevoRol)) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("Rol inválido"));
  }

  const objetivo = await prisma.usuarioPropiedad.findFirst({
    where: { id: usuarioPropiedadId, propiedadId: usuario.propiedadId },
  });
  if (!objetivo) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("Usuario no encontrado"));
  }

  if (objetivo.rol === RolUsuario.ADMIN && nuevoRol !== RolUsuario.ADMIN) {
    const otrosAdmins = await prisma.usuarioPropiedad.count({
      where: { propiedadId: usuario.propiedadId, rol: RolUsuario.ADMIN, id: { not: objetivo.id } },
    });
    if (otrosAdmins === 0) {
      redirect("/panel/configuracion?error=" + encodeURIComponent("Debe existir al menos un administrador"));
    }
  }

  await prisma.usuarioPropiedad.update({ where: { id: objetivo.id }, data: { rol: nuevoRol } });
  redirect("/panel/configuracion?rolActualizado=1");
}

export async function quitarUsuarioAction(formData: FormData) {
  const usuario = await requireAdmin();
  const usuarioPropiedadId = formData.get("usuarioPropiedadId") as string;

  const objetivo = await prisma.usuarioPropiedad.findFirst({
    where: { id: usuarioPropiedadId, propiedadId: usuario.propiedadId },
  });
  if (!objetivo) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("Usuario no encontrado"));
  }

  if (objetivo.clerkUserId === usuario.clerkUserId) {
    redirect("/panel/configuracion?error=" + encodeURIComponent("No puedes quitarte a ti mismo. Pide a otro administrador que lo haga."));
  }

  if (objetivo.rol === RolUsuario.ADMIN) {
    const otrosAdmins = await prisma.usuarioPropiedad.count({
      where: { propiedadId: usuario.propiedadId, rol: RolUsuario.ADMIN, id: { not: objetivo.id } },
    });
    if (otrosAdmins === 0) {
      redirect("/panel/configuracion?error=" + encodeURIComponent("Debe existir al menos un administrador"));
    }
  }

  await prisma.usuarioPropiedad.delete({ where: { id: objetivo.id } });
  redirect("/panel/configuracion?usuarioEliminado=1");
}

// ── Stripe Connect (pagos de huéspedes directo a la cuenta del hotel) ───────

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

// Crea (si no existe) la cuenta Express del hotel y genera el link de
// onboarding alojado por Stripe. El hotel llena sus datos bancarios/fiscales
// directamente con Stripe — Roomly nunca los recibe ni los almacena.
export async function iniciarConexionStripeAction() {
  const usuario = await requireAdmin();
  const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: usuario.propiedadId } });

  if (propiedad.planActivo !== "PRO") {
    redirect("/panel/configuracion?tab=plan&error=" + encodeURIComponent("Necesitas el plan Pro para conectar pagos con tarjeta"));
  }

  let accountId = propiedad.stripeConnectAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      country: "MX",
      email: propiedad.email || undefined,
      business_profile: { name: propiedad.nombre, product_description: "Hospedaje en hotel" },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });
    accountId = account.id;
    await prisma.propiedad.update({
      where: { id: propiedad.id },
      data: { stripeConnectAccountId: accountId },
    });
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl()}/api/stripe-connect/refresh?propiedadId=${propiedad.id}`,
    return_url: `${appUrl()}/api/stripe-connect/return?propiedadId=${propiedad.id}`,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}

// Link temporal al dashboard de Stripe del hotel — ahí ven sus propios
// pagos y depósitos directamente, sin pasar por Roomly.
export async function abrirDashboardStripeAction() {
  const usuario = await requireAdmin();
  const propiedad = await prisma.propiedad.findUniqueOrThrow({ where: { id: usuario.propiedadId } });

  if (!propiedad.stripeConnectAccountId) {
    redirect("/panel/configuracion?tab=pagos&error=" + encodeURIComponent("Aún no conectas tu cuenta de Stripe"));
  }

  const loginLink = await stripe.accounts.createLoginLink(propiedad.stripeConnectAccountId);
  redirect(loginLink.url);
}
