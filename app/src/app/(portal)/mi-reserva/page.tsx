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

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  CONFIRMADA:  { label: "Confirmada",       bg: "bg-blue-100",   text: "text-blue-800"   },
  EN_CURSO:    { label: "Huésped presente", bg: "bg-green-100",  text: "text-green-800"  },
  COMPLETADA:  { label: "Completada",       bg: "bg-gray-100",   text: "text-gray-600"   },
  CANCELADA:   { label: "Cancelada",        bg: "bg-red-100",    text: "text-red-700"    },
  NO_SHOW:     { label: "No se presentó",   bg: "bg-orange-100", text: "text-orange-800" },
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

    const res = await fetch(
      `/api/reservas/consulta?codigo=${encodeURIComponent(codigo)}&email=${encodeURIComponent(email)}`
    );
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

  const noches = reserva
    ? Math.round(
        (new Date(reserva.fechaSalida).getTime() - new Date(reserva.fechaIngreso).getTime()) /
          86400000
      )
    : 0;

  const estadoInfo = reserva ? (ESTADO_CONFIG[reserva.estado] ?? { label: reserva.estado, bg: "bg-gray-100", text: "text-gray-700" }) : null;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Mi reserva</h1>
          <p className="text-sm text-gray-500">
            Ingresa tu código y correo para consultar o gestionar tu reserva.
          </p>
        </div>

        {/* Formulario de búsqueda */}
        {!reserva && !cancelado && (
          <form
            onSubmit={buscarReserva}
            className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Código de reserva
              </label>
              <input
                type="text"
                placeholder="RES-XXXX-XXXX"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                El mismo correo con el que hiciste la reserva.
              </p>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={cargando}
              className="w-full rounded-xl bg-gray-900 text-white py-3 text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {cargando ? "Buscando..." : "Consultar reserva"}
            </button>
          </form>
        )}

        {/* Cancelación confirmada */}
        {cancelado && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">Reserva cancelada</h2>
            <p className="text-sm text-gray-500">
              Recibirás la confirmación y los detalles del reembolso en tu correo.
            </p>
          </div>
        )}

        {/* Detalle de la reserva */}
        {reserva && !cancelado && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Encabezado con código y estado */}
              <div className="px-5 py-4 flex items-start justify-between border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-0.5">Código</p>
                  <p className="font-mono font-bold text-gray-900 text-lg tracking-wider">
                    {reserva.codigoReserva}
                  </p>
                </div>
                {estadoInfo && (
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${estadoInfo.bg} ${estadoInfo.text}`}>
                    {estadoInfo.label}
                  </span>
                )}
              </div>

              {/* Fechas */}
              <div className="px-5 py-4 grid grid-cols-2 gap-4 border-b border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Check-in</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(reserva.fechaIngreso).toLocaleDateString("es-MX", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Check-out</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(reserva.fechaSalida).toLocaleDateString("es-MX", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>
              </div>

              {/* Habitación, noches y total */}
              <div className="px-5 py-4 flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Habitación</p>
                  <p className="text-sm font-semibold text-gray-900">{reserva.tipoDeHabitacion.nombre}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{noches} noche{noches !== 1 ? "s" : ""}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total</p>
                  <p className="text-sm font-bold text-gray-900">
                    ${Number(reserva.totalMxn).toLocaleString("es-MX")} MXN
                  </p>
                </div>
              </div>
            </div>

            {/* Acciones */}
            {reserva.cancelable && !confirmandoCancelacion && (
              <button
                onClick={() => setConfirmandoCancelacion(true)}
                className="w-full rounded-xl border border-red-200 text-red-600 py-3 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Cancelar reserva
              </button>
            )}

            {reserva.origen === "MANUAL" && reserva.estado === "CONFIRMADA" && (
              <p className="text-xs text-gray-400 text-center px-4">
                Para modificar o cancelar esta reserva, contacta directamente al hotel.
              </p>
            )}

            {/* Confirmación de cancelación */}
            {confirmandoCancelacion && (
              <div className="bg-red-50 rounded-2xl border border-red-200 p-5">
                <p className="text-sm font-semibold text-red-900 mb-1">¿Confirmas la cancelación?</p>
                <p className="text-xs text-red-700 mb-4">
                  Reembolso: <span className="font-semibold">${reserva.montoReembolso.toLocaleString("es-MX")} MXN</span>
                  {reserva.comisionRetenida > 0 && (
                    <span className="text-red-500">
                      {" "}(comisión Stripe retenida: ${reserva.comisionRetenida.toLocaleString("es-MX")} MXN)
                    </span>
                  )}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={cancelarReserva}
                    disabled={cancelando}
                    className="flex-1 rounded-xl bg-red-600 text-white py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {cancelando ? "Cancelando..." : "Confirmar"}
                  </button>
                  <button
                    onClick={() => setConfirmandoCancelacion(false)}
                    className="flex-1 rounded-xl border border-gray-200 text-gray-700 py-2.5 text-sm font-medium hover:bg-white"
                  >
                    Volver
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Buscar otra reserva */}
            <button
              onClick={() => { setReserva(null); setCodigo(""); setEmail(""); setError(null); }}
              className="w-full text-sm text-gray-400 hover:text-gray-700 py-2 transition-colors"
            >
              Consultar otra reserva
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
