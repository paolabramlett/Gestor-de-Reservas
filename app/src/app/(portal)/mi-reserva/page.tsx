"use client";

import { useState } from "react";

type ReservaDetalle = {
  codigoReserva: string;
  estado: string;
  fechaIngreso: string;
  fechaSalida: string;
  totalMxn: number;
  tipoDeHabitacion: { nombre: string };
  huesped: { nombre: string; email: string };
  origen: string;
  cancelable: boolean;
  montoReembolso: number;
  comisionRetenida: number;
};

export default function MiReservaPage() {
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [reserva, setReserva] = useState<ReservaDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cancelado, setCancelado] = useState(false);
  const [confirmandoCancelacion, setConfirmandoCancelacion] = useState(false);

  async function buscarReserva(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setReserva(null);

    const res = await fetch(`/api/reservas/consulta?codigo=${encodeURIComponent(codigo)}&email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!res.ok) {
      setError("No encontramos una reserva con esos datos. Verifica tu código y correo.");
    } else {
      setReserva(data);
    }
    setCargando(false);
  }

  async function cancelarReserva() {
    setCancelando(true);
    const res = await fetch("/api/reservas/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, email }),
    });

    if (res.ok) {
      setCancelado(true);
    } else {
      const data = await res.json();
      setError(data.error ?? "Error al cancelar");
    }
    setCancelando(false);
    setConfirmandoCancelacion(false);
  }

  const estadoLabels: Record<string, string> = {
    CONFIRMADA: "Confirmada",
    EN_CURSO: "Huésped presente",
    COMPLETADA: "Completada",
    CANCELADA: "Cancelada",
    NO_SHOW: "No se presentó",
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Mi reserva</h1>
        <p className="text-sm text-gray-500 mb-8 text-center">
          Ingresa tu código de reserva y correo para consultar o cancelar.
        </p>

        {!reserva && !cancelado && (
          <form onSubmit={buscarReserva} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de reserva</label>
              <input
                type="text"
                placeholder="RES-XXXX-XXXX"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-lg bg-gray-900 text-white py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {cargando ? "Buscando..." : "Consultar reserva"}
            </button>
          </form>
        )}

        {cancelado && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center shadow-sm">
            <div className="text-3xl mb-3">✅</div>
            <h2 className="font-semibold text-gray-900 mb-1">Reserva cancelada</h2>
            <p className="text-sm text-gray-500">Recibirás la confirmación y detalles del reembolso por correo.</p>
          </div>
        )}

        {reserva && !cancelado && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Código</p>
                <p className="font-mono font-bold text-gray-900">{reserva.codigoReserva}</p>
              </div>
              <span className="text-xs font-medium bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                {estadoLabels[reserva.estado] ?? reserva.estado}
              </span>
            </div>
            <div className="text-sm text-gray-600 space-y-1.5 border-t border-gray-100 pt-4">
              <p><span className="font-medium">Habitación:</span> {reserva.tipoDeHabitacion.nombre}</p>
              <p><span className="font-medium">Llegada:</span> {new Date(reserva.fechaIngreso).toLocaleDateString("es-MX")}</p>
              <p><span className="font-medium">Salida:</span> {new Date(reserva.fechaSalida).toLocaleDateString("es-MX")}</p>
              <p><span className="font-medium">Total:</span> ${Number(reserva.totalMxn).toLocaleString("es-MX")} MXN</p>
            </div>

            {reserva.cancelable && !confirmandoCancelacion && (
              <button
                onClick={() => setConfirmandoCancelacion(true)}
                className="mt-6 w-full rounded-lg border border-red-300 text-red-600 py-2.5 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Cancelar reserva
              </button>
            )}

            {reserva.origen === "MANUAL" && reserva.estado === "CONFIRMADA" && (
              <p className="mt-4 text-xs text-gray-400 text-center">
                Para modificar o cancelar esta reserva, contacta directamente al hotel.
              </p>
            )}

            {confirmandoCancelacion && (
              <div className="mt-6 bg-red-50 rounded-lg border border-red-200 p-4">
                <p className="text-sm font-medium text-red-800 mb-1">¿Confirmas la cancelación?</p>
                <p className="text-xs text-red-600 mb-3">
                  Reembolso: ${reserva.montoReembolso.toLocaleString("es-MX")} MXN
                  {reserva.comisionRetenida > 0 && (
                    <span> (se retienen ${reserva.comisionRetenida.toLocaleString("es-MX")} MXN de comisión de pasarela)</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={cancelarReserva}
                    disabled={cancelando}
                    className="flex-1 rounded-lg bg-red-600 text-white py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelando ? "Cancelando..." : "Confirmar cancelación"}
                  </button>
                  <button
                    onClick={() => setConfirmandoCancelacion(false)}
                    className="flex-1 rounded-lg border border-gray-300 text-gray-700 py-2 text-sm"
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
