"use client";

import { useState } from "react";
import type { PlanRoomly } from "@prisma/client";

const PLANES: Record<
  PlanRoomly,
  { nombre: string; precio: string; features: string[] }
> = {
  ESENCIAL: {
    nombre: "Esencial",
    precio: "$399 MXN/mes",
    features: [
      "Panel de reservas y calendario",
      "Registro manual de pagos",
      "Reportes de ocupación",
      "Hasta 3 usuarios",
    ],
  },
  PRO: {
    nombre: "Pro",
    precio: "$999 MXN/mes",
    features: [
      "Todo lo del plan Esencial",
      "Portal de reservas online",
      "Solicitar pago con tarjeta",
      "Links de pago por WhatsApp",
    ],
  },
};

type Props = {
  planActivo: PlanRoomly;
  suscripcionActiva: boolean;
  canceladaAlFinalDePeriodo: boolean;
  finDePeriodoActual: string | null;
  cambiarPlanAction: (fd: FormData) => Promise<void>;
  cancelarSuscripcionAction: () => Promise<void>;
  reactivarSuscripcionAction: () => Promise<void>;
};

export function PlanSection({
  planActivo,
  suscripcionActiva,
  canceladaAlFinalDePeriodo,
  finDePeriodoActual,
  cambiarPlanAction,
  cancelarSuscripcionAction,
  reactivarSuscripcionAction,
}: Props) {
  const [modal, setModal] = useState<"cambiar" | "cancelar" | null>(null);
  const [pending, setPending] = useState(false);

  const otroPlan: PlanRoomly = planActivo === "PRO" ? "ESENCIAL" : "PRO";
  const esUpgrade = otroPlan === "PRO";
  const fechaFin = finDePeriodoActual
    ? new Date(finDePeriodoActual).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
    : null;

  async function handleCambiarPlan() {
    setPending(true);
    const fd = new FormData();
    fd.set("plan", otroPlan);
    await cambiarPlanAction(fd);
  }

  async function handleCancelar() {
    setPending(true);
    await cancelarSuscripcionAction();
  }

  async function handleReactivar() {
    setPending(true);
    await reactivarSuscripcionAction();
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">Tu plan</h2>
        {!suscripcionActiva && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
            Inactiva
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-lg font-bold text-gray-900">{PLANES[planActivo].nombre}</p>
          <p className="text-sm text-gray-500">{PLANES[planActivo].precio}</p>
        </div>
      </div>

      <ul className="space-y-1 mb-4">
        {PLANES[planActivo].features.map((f) => (
          <li key={f} className="text-xs text-gray-500 flex gap-1.5">
            <span className="text-green-500">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {canceladaAlFinalDePeriodo && fechaFin && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
          Tu suscripción se cancelará el <strong>{fechaFin}</strong>. Seguirás teniendo acceso hasta esa fecha.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModal("cambiar")}
          disabled={pending}
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {esUpgrade ? `Subir a ${PLANES.PRO.nombre}` : `Cambiar a ${PLANES.ESENCIAL.nombre}`}
        </button>

        {canceladaAlFinalDePeriodo ? (
          <button
            type="button"
            onClick={handleReactivar}
            disabled={pending}
            className="rounded-lg border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Reactivar suscripción
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setModal("cancelar")}
            disabled={pending}
            className="rounded-lg border border-gray-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
          >
            Cancelar suscripción
          </button>
        )}
      </div>

      {modal === "cambiar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              {esUpgrade ? `Subir a ${PLANES.PRO.nombre}` : `Cambiar a ${PLANES.ESENCIAL.nombre}`}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              {esUpgrade
                ? `Tu plan cambiará a Pro (${PLANES.PRO.precio}) de inmediato. Se cobrará la diferencia prorrateada en tu próximo recibo.`
                : `Tu plan cambiará a Esencial (${PLANES.ESENCIAL.precio}). Perderás acceso al portal de reservas online y a solicitar pagos con tarjeta.`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={pending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCambiarPlan}
                disabled={pending}
                className="flex-1 rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                {pending ? "Aplicando…" : "Confirmar cambio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "cancelar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">¿Cancelar tu suscripción?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Seguirás teniendo acceso completo hasta el final de tu periodo de facturación actual.
              Después de esa fecha, tu equipo no podrá entrar al panel hasta que reactives el plan.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModal(null)}
                disabled={pending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancelar}
                disabled={pending}
                className="flex-1 rounded-lg bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Cancelando…" : "Sí, cancelar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
