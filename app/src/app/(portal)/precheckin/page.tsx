"use client";

import { useState } from "react";

type Registro = {
  documentoTipo: string | null;
  documentoNumero: string | null;
  nacionalidad: string | null;
  placasVehiculo: string | null;
  politicasAceptadas: boolean;
};

type Info = {
  nombreHotel: string;
  nombreHuesped: string;
  tipoHabitacion: string;
  fechaIngreso: string;
  fechaSalida: string;
  registro: Registro;
};

const DOCUMENTOS = [
  { value: "INE", label: "INE" },
  { value: "PASAPORTE", label: "Pasaporte" },
  { value: "OTRO", label: "Otro" },
];

export default function PreCheckInPage() {
  const [codigo, setCodigo] = useState("");
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState(false);

  const [documentoTipo, setDocumentoTipo] = useState("INE");
  const [documentoNumero, setDocumentoNumero] = useState("");
  const [nacionalidad, setNacionalidad] = useState("Mexicana");
  const [placasVehiculo, setPlacasVehiculo] = useState("");
  const [politicasAceptadas, setPoliticasAceptadas] = useState(false);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setInfo(null);

    const res = await fetch("/api/reservas/precheckin/buscar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo, email }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "No encontramos tu reserva");
    } else {
      setInfo(data);
      setDocumentoTipo(data.registro.documentoTipo ?? "INE");
      setDocumentoNumero(data.registro.documentoNumero ?? "");
      setNacionalidad(data.registro.nacionalidad ?? "Mexicana");
      setPlacasVehiculo(data.registro.placasVehiculo ?? "");
      setPoliticasAceptadas(data.registro.politicasAceptadas ?? false);
    }
    setCargando(false);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const res = await fetch("/api/reservas/precheckin/guardar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo,
        email,
        documentoTipo,
        documentoNumero,
        nacionalidad,
        placasVehiculo,
        politicasAceptadas,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "No se pudo guardar tu registro");
    } else {
      setListo(true);
    }
    setGuardando(false);
  }

  const noches = info
    ? Math.round((new Date(info.fechaSalida).getTime() - new Date(info.fechaIngreso).getTime()) / 86400000)
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Pre-check-in</h1>
          <p className="text-sm text-gray-500">
            Llena tus datos antes de llegar y ahorra tiempo en recepción.
          </p>
        </div>

        {listo && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="font-bold text-gray-900 text-lg mb-1">¡Listo!</h2>
            <p className="text-sm text-gray-500">
              Ya completaste tu registro. En recepción solo confirmarán tu llegada.
            </p>
          </div>
        )}

        {!info && !listo && (
          <form onSubmit={buscar} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de reserva</label>
              <input
                type="text"
                placeholder="RES-XXXX-XXXX o GRP-XXXX-XXXX"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1"
                required
              />
              <p className="text-xs text-gray-400 mt-1">El mismo correo con el que hiciste la reserva.</p>
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
              {cargando ? "Buscando..." : "Continuar"}
            </button>
          </form>
        )}

        {info && !listo && (
          <form onSubmit={guardar} className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{info.nombreHotel}</p>
              <p className="font-semibold text-gray-900 mb-2">{info.nombreHuesped}</p>
              <p className="text-sm text-gray-600">
                {info.tipoHabitacion} · {noches} noche{noches !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(info.fechaIngreso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })}
                {" → "}
                {new Date(info.fechaSalida).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Documento</label>
                  <select
                    value={documentoTipo}
                    onChange={(e) => setDocumentoTipo(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  >
                    {DOCUMENTOS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número</label>
                  <input
                    value={documentoNumero}
                    onChange={(e) => setDocumentoNumero(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nacionalidad</label>
                  <input
                    value={nacionalidad}
                    onChange={(e) => setNacionalidad(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Placas <span className="text-gray-400 font-normal">(si aplica)</span>
                  </label>
                  <input
                    value={placasVehiculo}
                    onChange={(e) => setPlacasVehiculo(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={politicasAceptadas}
                  onChange={(e) => setPoliticasAceptadas(e.target.checked)}
                  required
                  className="mt-0.5 w-4 h-4 rounded border-gray-300"
                />
                <span className="text-xs text-gray-600">
                  Acepto las políticas del hotel y confirmo que la información es correcta.
                </span>
              </label>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={guardando}
                className="w-full rounded-xl bg-gray-900 text-white py-3 text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {guardando ? "Guardando..." : "Completar pre-check-in"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
