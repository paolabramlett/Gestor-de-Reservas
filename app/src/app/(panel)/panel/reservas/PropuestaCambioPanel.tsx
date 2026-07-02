"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/DatePicker";

type SolicitudPendiente = {
  id: string;
  token: string;
  fechaIngresoNueva: string;
  fechaSalidaNueva: string;
  totalActual: number;
  totalNuevo: number;
  diferencia: number;
  expiresAt: string;
};

type SolicitudResuelta = {
  estado: string;
  fechaIngresoNueva: string;
  fechaSalidaNueva: string;
  creadoEn: string;
};

export function PropuestaCambioPanel({
  reservaId,
  fechaIngresoActual,
  fechaSalidaActual,
  numPersonas,
  tipoDeHabitacionId,
  totalActual,
  solicitudPendiente,
  ultimaSolicitudResuelta,
}: {
  reservaId: string;
  fechaIngresoActual: string;
  fechaSalidaActual: string;
  numPersonas: number;
  tipoDeHabitacionId: string;
  totalActual: number;
  solicitudPendiente?: SolicitudPendiente | null;
  ultimaSolicitudResuelta?: SolicitudResuelta | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fechaIngreso, setFechaIngreso] = useState(fechaIngresoActual);
  const [fechaSalida, setFechaSalida] = useState(fechaSalidaActual);
  const [preview, setPreview] = useState<{ totalNuevo: number; diferencia: number; esCobro: boolean } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const hoy = new Date().toISOString().split("T")[0];

  async function calcularPreview() {
    if (!fechaIngreso || !fechaSalida) return;
    if (fechaSalida <= fechaIngreso) {
      setError("La fecha de salida debe ser posterior a la fecha de llegada.");
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tarifas/calcular?tipoId=${tipoDeHabitacionId}&fechaIngreso=${fechaIngreso}&fechaSalida=${fechaSalida}&numPersonas=${numPersonas}`
      );
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      const diff = data.total - totalActual;
      const comision = Math.round((Math.abs(diff) * 0.036 + 3) * 100) / 100;
      const diferenciaNeta = diff > 0 ? diff + comision : diff - comision;
      setPreview({ totalNuevo: data.total, diferencia: diferenciaNeta, esCobro: diferenciaNeta > 0 });
    } finally {
      setLoadingPreview(false);
    }
  }

  async function enviarPropuesta() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reservas/${reservaId}/proponer-cambio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fechaIngresoNueva: fechaIngreso, fechaSalidaNueva: fechaSalida }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setOpen(false);
      setConfirmando(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function cancelarPropuesta(token: string) {
    setCancelLoading(true);
    try {
      const res = await fetch(`/api/cambios/${token}/cancelar`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setCancelLoading(false);
    }
  }

  if (solicitudPendiente) {
    const diff = solicitudPendiente.diferencia;
    const esCobro = diff > 0;
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-amber-900">Propuesta de cambio pendiente</p>
            <p className="text-xs text-amber-700 mt-0.5">Esperando respuesta del huésped</p>
          </div>
          <span className="text-xs bg-amber-200 text-amber-800 rounded-full px-2.5 py-1 font-medium shrink-0">Pendiente</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-amber-700">Check-in nuevo</p>
            <p className="font-medium text-amber-900">{new Date(solicitudPendiente.fechaIngresoNueva + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
          <div>
            <p className="text-xs text-amber-700">Check-out nuevo</p>
            <p className="font-medium text-amber-900">{new Date(solicitudPendiente.fechaSalidaNueva + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}</p>
          </div>
          <div>
            <p className="text-xs text-amber-700">Total nuevo</p>
            <p className="font-medium text-amber-900">${solicitudPendiente.totalNuevo.toLocaleString("es-MX")} MXN</p>
          </div>
          <div>
            <p className="text-xs text-amber-700">{esCobro ? "Cargo adicional" : "Reembolso"}</p>
            <p className={`font-medium ${esCobro ? "text-amber-900" : "text-green-700"}`}>
              ${Math.abs(diff).toLocaleString("es-MX")} MXN
            </p>
          </div>
        </div>

        <p className="text-xs text-amber-600 mt-3">
          Expira: {new Date(solicitudPendiente.expiresAt).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
        </p>

        <button
          onClick={() => cancelarPropuesta(solicitudPendiente.token)}
          disabled={cancelLoading}
          className="mt-4 w-full rounded-lg border border-amber-300 text-amber-800 text-sm font-medium py-2 hover:bg-amber-100 disabled:opacity-50"
        >
          {cancelLoading ? "Cancelando..." : "Cancelar propuesta"}
        </button>
      </div>
    );
  }

  const fmtFecha = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

  const bannerResuelta = ultimaSolicitudResuelta && !open ? (() => {
    const { estado, fechaIngresoNueva, fechaSalidaNueva, creadoEn } = ultimaSolicitudResuelta;
    const fechaPropuesta = new Date(creadoEn).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
    if (estado === "RECHAZADA") return (
      <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3 items-start">
        <span className="text-red-500 mt-0.5 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-red-800">El huésped rechazó el cambio de fechas</p>
          <p className="text-xs text-red-600 mt-0.5">
            Propuesta del {fechaPropuesta}: {fmtFecha(fechaIngresoNueva)} → {fmtFecha(fechaSalidaNueva)}
          </p>
          <p className="text-xs text-red-500 mt-1">Puedes proponer nuevas fechas si lo deseas.</p>
        </div>
      </div>
    );
    if (estado === "EXPIRADA") return (
      <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-4 flex gap-3 items-start">
        <span className="text-gray-400 mt-0.5 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m-4-8a9 9 0 110 18 9 9 0 010-18z" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-700">La propuesta de cambio expiró sin respuesta</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Propuesta del {fechaPropuesta}: {fmtFecha(fechaIngresoNueva)} → {fmtFecha(fechaSalidaNueva)}
          </p>
          <p className="text-xs text-gray-400 mt-1">Puedes enviar una nueva propuesta.</p>
        </div>
      </div>
    );
    if (estado === "CANCELADA") return (
      <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-4 flex gap-3 items-start">
        <span className="text-gray-400 mt-0.5 shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-700">Propuesta de cambio cancelada</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Propuesta del {fechaPropuesta}: {fmtFecha(fechaIngresoNueva)} → {fmtFecha(fechaSalidaNueva)}
          </p>
        </div>
      </div>
    );
    return null;
  })() : null;

  return (
    <div>
      {bannerResuelta}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-gray-200 text-gray-700 text-sm font-medium py-2.5 hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Proponer cambio de fechas
        </button>
      ) : (
        <div className="rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Proponer cambio de fechas</p>
            <button onClick={() => { setOpen(false); setPreview(null); setError(null); setConfirmando(false); }} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nueva llegada</label>
              <DatePicker
                name="fechaIngreso"
                value={fechaIngreso}
                min={hoy}
                onChange={(iso) => {
                  setPreview(null);
                  setError(null);
                  setFechaIngreso(iso);
                  // Auto-advance salida si ingreso la alcanza o supera
                  if (iso >= fechaSalida) {
                    const next = new Date(iso + "T12:00:00");
                    next.setDate(next.getDate() + 1);
                    setFechaSalida(next.toISOString().split("T")[0]);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Nueva salida</label>
              <DatePicker
                name="fechaSalida"
                value={fechaSalida}
                min={(() => { const d = new Date(fechaIngreso + "T12:00:00"); d.setDate(d.getDate() + 1); return d.toISOString().split("T")[0]; })()}
                onChange={(iso) => {
                  setPreview(null);
                  setError(null);
                  setFechaSalida(iso);
                }}
              />
            </div>
          </div>

          {!preview && (
            <button
              onClick={calcularPreview}
              disabled={loadingPreview || !fechaIngreso || !fechaSalida || fechaSalida <= fechaIngreso}
              className="w-full rounded-lg bg-gray-100 text-gray-700 text-sm font-medium py-2 hover:bg-gray-200 disabled:opacity-50"
            >
              {loadingPreview ? "Calculando..." : "Calcular diferencia"}
            </button>
          )}

          {preview && !confirmando && (
            <>
              <div className={`rounded-xl p-4 space-y-2 text-sm ${preview.esCobro ? "bg-amber-50 border border-amber-100" : "bg-green-50 border border-green-100"}`}>
                <div className="flex justify-between">
                  <span className="text-gray-500">Nuevo total</span>
                  <span className="font-semibold">${preview.totalNuevo.toLocaleString("es-MX")} MXN</span>
                </div>
                <div className="flex justify-between">
                  <span className={preview.esCobro ? "text-amber-700" : "text-green-700"}>
                    {preview.esCobro ? "Cargo adicional al huésped" : "Reembolso al huésped"}
                  </span>
                  <span className={`font-semibold ${preview.esCobro ? "text-amber-800" : "text-green-700"}`}>
                    ${Math.abs(preview.diferencia).toLocaleString("es-MX")} MXN
                  </span>
                </div>
                <p className="text-xs text-gray-400 pt-1">Incluye comisión bancaria Stripe (~3.6% + $3 MXN)</p>
              </div>
              <button
                onClick={() => setConfirmando(true)}
                className="w-full rounded-xl bg-gray-900 text-white text-sm font-semibold py-2.5 hover:bg-gray-700"
              >
                Enviar propuesta al huésped
              </button>
            </>
          )}

          {confirmando && preview && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 text-center">
                Se enviará un correo al huésped con 24h para aceptar o rechazar.{" "}
                {preview.esCobro
                  ? `Si acepta, se le cobrará $${Math.abs(preview.diferencia).toLocaleString("es-MX")} MXN.`
                  : `Si acepta, se le reembolsarán $${Math.abs(preview.diferencia).toLocaleString("es-MX")} MXN.`}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmando(false)}
                  disabled={loading}
                  className="flex-1 rounded-xl border border-gray-200 text-gray-600 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  onClick={enviarPropuesta}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-gray-900 text-white py-2.5 text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Confirmar y enviar"}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        </div>
      )}
    </div>
  );
}
