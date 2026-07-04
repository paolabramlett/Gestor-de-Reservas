import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ConfiguracionForm from "./ConfiguracionForm";
import { PlanSection } from "./PlanSection";
import {
  cambiarPlanAction,
  cancelarSuscripcionAction,
  reactivarSuscripcionAction,
} from "./actions";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string; error?: string; cancelada?: string; reactivada?: string; plan?: string }>;
}) {
  const usuario = await requireAdmin();

  const { guardado, error, cancelada, reactivada, plan } = await searchParams;

  const propiedad = await prisma.propiedad.findUnique({
    where: { id: usuario.propiedadId },
  });
  if (!propiedad) redirect("/sign-in");

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
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <PlanSection
        planActivo={propiedad.planActivo}
        suscripcionActiva={propiedad.suscripcionActiva}
        canceladaAlFinalDePeriodo={propiedad.canceladaAlFinalDePeriodo}
        finDePeriodoActual={propiedad.finDePeriodoActual?.toISOString() ?? null}
        cambiarPlanAction={cambiarPlanAction}
        cancelarSuscripcionAction={cancelarSuscripcionAction}
        reactivarSuscripcionAction={reactivarSuscripcionAction}
      />

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
    </div>
  );
}
