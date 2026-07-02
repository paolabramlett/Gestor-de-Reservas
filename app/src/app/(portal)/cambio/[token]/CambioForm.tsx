"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SolicitudInfo = {
  fechaIngresoActual: string;
  fechaSalidaActual: string;
  fechaIngresoNueva: string;
  fechaSalidaNueva: string;
  totalActual: number;
  totalNuevo: number;
  diferencia: number;
  esCobro: boolean;
  expiresAt: string;
};

export default function CambioForm({
  token,
  solicitud,
  colorPrimario,
}: {
  token: string;
  solicitud: SolicitudInfo;
  colorPrimario: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<"aceptar" | "rechazar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<"aceptar" | "rechazar" | null>(null);

  async function ejecutar(accion: "aceptar" | "rechazar") {
    setLoading(accion);
    setError(null);
    try {
      const res = await fetch(`/api/cambios/${token}/${accion}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al procesar");
        setLoading(null);
        return;
      }
      if (data.cobroManualRequerido) {
        // El hotel procesará el cobro adicional manualmente
      }
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
      setLoading(null);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Detalle del cambio propuesto</p>

        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-400 font-medium pb-1"> </th>
              <th className="text-left text-xs text-gray-400 font-medium pb-1">Check-in</th>
              <th className="text-left text-xs text-gray-400 font-medium pb-1">Check-out</th>
              <th className="text-right text-xs text-gray-400 font-medium pb-1">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-gray-400">
              <td className="py-1 text-xs">Actual</td>
              <td className="py-1">{solicitud.fechaIngresoActual}</td>
              <td className="py-1">{solicitud.fechaSalidaActual}</td>
              <td className="py-1 text-right">${solicitud.totalActual.toLocaleString("es-MX")} MXN</td>
            </tr>
            <tr className="text-gray-900 font-semibold">
              <td className="py-1 text-xs">Nuevo</td>
              <td className="py-1">{solicitud.fechaIngresoNueva}</td>
              <td className="py-1">{solicitud.fechaSalidaNueva}</td>
              <td className="py-1 text-right">${solicitud.totalNuevo.toLocaleString("es-MX")} MXN</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={`rounded-xl p-4 ${solicitud.esCobro ? "bg-amber-50 border border-amber-100" : "bg-green-50 border border-green-100"}`}>
        {solicitud.esCobro ? (
          <p className="text-sm text-amber-800">
            Al aceptar, se realizará un <strong>cargo adicional de ${Math.abs(solicitud.diferencia).toLocaleString("es-MX")} MXN</strong> a tu método de pago original (incluye comisión bancaria).
          </p>
        ) : (
          <p className="text-sm text-green-800">
            Al aceptar, recibirás un <strong>reembolso de ${Math.abs(solicitud.diferencia).toLocaleString("es-MX")} MXN</strong> en tu método de pago original en 5–10 días hábiles (descontando comisión bancaria no recuperable).
          </p>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Esta propuesta expira el <strong>{solicitud.expiresAt}</strong>
      </p>

      {error && (
        <p className="text-sm text-red-600 text-center bg-red-50 rounded-lg py-2 px-3">{error}</p>
      )}

      {confirmando ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700 text-center font-medium">
            {confirmando === "aceptar"
              ? "¿Confirmas que deseas aceptar este cambio?"
              : "¿Confirmas que deseas rechazar este cambio?"}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmando(null)}
              disabled={!!loading}
              className="flex-1 rounded-xl border border-gray-200 text-gray-600 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              Volver
            </button>
            <button
              onClick={() => ejecutar(confirmando)}
              disabled={!!loading}
              style={confirmando === "aceptar" ? { backgroundColor: colorPrimario } : undefined}
              className={`flex-1 rounded-xl text-white py-2.5 text-sm font-semibold disabled:opacity-50 ${
                confirmando === "rechazar" ? "bg-red-600 hover:bg-red-700" : "hover:opacity-90"
              }`}
            >
              {loading ? "Procesando..." : confirmando === "aceptar" ? "Sí, aceptar" : "Sí, rechazar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => setConfirmando("rechazar")}
            disabled={!!loading}
            className="flex-1 rounded-xl border border-gray-200 text-gray-700 py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
          >
            Rechazar
          </button>
          <button
            onClick={() => setConfirmando("aceptar")}
            disabled={!!loading}
            style={{ backgroundColor: colorPrimario }}
            className="flex-1 rounded-xl text-white py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            Aceptar cambio
          </button>
        </div>
      )}
    </div>
  );
}
