import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import ConfiguracionForm from "./ConfiguracionForm";
import { PlanSection } from "./PlanSection";
import { EquipoSection, type MiembroEquipo, type InvitacionPendiente } from "./EquipoSection";
import { ConfiguracionTabs } from "./ConfiguracionTabs";
import {
  cambiarPlanAction,
  cancelarSuscripcionAction,
  reactivarSuscripcionAction,
  enviarInvitacionAction,
  cancelarInvitacionAction,
  actualizarRolUsuarioAction,
  quitarUsuarioAction,
} from "./actions";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{
    guardado?: string;
    error?: string;
    cancelada?: string;
    reactivada?: string;
    plan?: string;
    invitado?: string;
    invitacionCancelada?: string;
    rolActualizado?: string;
    usuarioEliminado?: string;
  }>;
}) {
  const usuario = await requireAdmin();

  const {
    guardado,
    error,
    cancelada,
    reactivada,
    plan,
    invitado,
    invitacionCancelada,
    rolActualizado,
    usuarioEliminado,
  } = await searchParams;

  const propiedad = await prisma.propiedad.findUnique({
    where: { id: usuario.propiedadId },
  });
  if (!propiedad) redirect("/sign-in");

  const [usuariosPropiedad, invitacionesPendientes] = await Promise.all([
    prisma.usuarioPropiedad.findMany({
      where: { propiedadId: usuario.propiedadId },
      orderBy: { creadoEn: "asc" },
    }),
    prisma.invitacionEquipo.findMany({
      where: {
        propiedadId: usuario.propiedadId,
        aceptadaEn: null,
        canceladaEn: null,
        expiraEn: { gt: new Date() },
      },
      orderBy: { creadoEn: "desc" },
    }),
  ]);

  const clerk = await clerkClient();
  const miembros: MiembroEquipo[] = await Promise.all(
    usuariosPropiedad.map(async (up) => {
      try {
        const clerkUser = await clerk.users.getUser(up.clerkUserId);
        const email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
          ?? clerkUser.emailAddresses[0]?.emailAddress
          ?? "";
        const nombre = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || email || "Usuario";
        return {
          usuarioPropiedadId: up.id,
          nombre,
          email,
          rol: up.rol,
          esYo: up.clerkUserId === usuario.clerkUserId,
        };
      } catch {
        return {
          usuarioPropiedadId: up.id,
          nombre: "Usuario",
          email: "",
          rol: up.rol,
          esYo: up.clerkUserId === usuario.clerkUserId,
        };
      }
    })
  );

  const invitaciones: InvitacionPendiente[] = invitacionesPendientes.map((inv) => ({
    id: inv.id,
    email: inv.email,
    rol: inv.rol,
    expiraEn: inv.expiraEn.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }),
  }));

  const initialTab: "hotel" | "plan" | "equipo" =
    cancelada || reactivada || (guardado && plan)
      ? "plan"
      : invitado || invitacionCancelada || rolActualizado || usuarioEliminado
      ? "equipo"
      : "hotel";

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Configuración del hotel</h1>

      {guardado && !plan && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Cambios guardados correctamente.
        </div>
      )}
      {guardado && plan && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Cambiaste tu plan a {plan === "pro" ? "Pro" : "Esencial"} correctamente.
        </div>
      )}
      {cancelada && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Tu suscripción se cancelará al final de tu periodo actual. Puedes reactivarla cuando quieras antes de esa fecha.
        </div>
      )}
      {reactivada && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Tu suscripción fue reactivada. Seguirá renovándose normalmente.
        </div>
      )}
      {invitado && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Invitación enviada correctamente.
        </div>
      )}
      {invitacionCancelada && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Invitación cancelada.
        </div>
      )}
      {rolActualizado && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Rol actualizado.
        </div>
      )}
      {usuarioEliminado && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          El usuario ya no tiene acceso a este hotel.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <ConfiguracionTabs
        initialTab={initialTab}
        plan={
          <PlanSection
            planActivo={propiedad.planActivo}
            suscripcionActiva={propiedad.suscripcionActiva}
            canceladaAlFinalDePeriodo={propiedad.canceladaAlFinalDePeriodo}
            finDePeriodoActual={propiedad.finDePeriodoActual?.toISOString() ?? null}
            cambiarPlanAction={cambiarPlanAction}
            cancelarSuscripcionAction={cancelarSuscripcionAction}
            reactivarSuscripcionAction={reactivarSuscripcionAction}
          />
        }
        equipo={
          <EquipoSection
            miembros={miembros}
            invitaciones={invitaciones}
            enviarInvitacionAction={enviarInvitacionAction}
            cancelarInvitacionAction={cancelarInvitacionAction}
            actualizarRolUsuarioAction={actualizarRolUsuarioAction}
            quitarUsuarioAction={quitarUsuarioAction}
          />
        }
        hotel={
          <ConfiguracionForm
            nombre={propiedad.nombre}
            descripcion={propiedad.descripcion ?? ""}
            telefono={propiedad.telefono ?? ""}
            email={propiedad.email ?? ""}
            direccion={propiedad.direccion ?? ""}
            colorPrimario={propiedad.colorPrimario ?? "#111827"}
            slug={propiedad.slug}
            logoUrl={propiedad.logoUrl ?? ""}
          />
        }
      />
    </div>
  );
}
