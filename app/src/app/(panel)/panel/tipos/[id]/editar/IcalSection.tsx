"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Feed = {
  id: string;
  nombre: string;
  url: string;
  lastSyncedAt: string | null;
};

export function IcalSection({
  tipoDeHabitacionId,
  exportUrl,
  feeds,
}: {
  tipoDeHabitacionId: string;
  exportUrl: string;
  feeds: Feed[];
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ical-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoDeHabitacionId, nombre, url }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Error");
      setNombre("");
      setUrl("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este feed? Se perderán los bloqueos importados.")) return;
    await fetch(`/api/ical-feeds/${id}`, { method: "DELETE" });
    router.refresh();
  }

  function copyUrl() {
    navigator.clipboard.writeText(exportUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-10 border-t border-gray-100 pt-8">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Sincronización iCal</h2>
      <p className="text-sm text-gray-500 mb-6">
        Conecta este tipo de habitación con Booking.com, Airbnb u otras OTAs mediante calendario iCal.
        Los cambios pueden tardar hasta 1 hora en reflejarse en OTAs externas.
      </p>

      {/* Export */}
      <div className="mb-8">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Exportar disponibilidad (Roomly → OTA)</h3>
        <p className="text-xs text-gray-400 mb-3">
          Suscribe esta URL en tu OTA para que descargue automáticamente las fechas ocupadas de Roomly.
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={exportUrl}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-gray-50 font-mono"
          />
          <button
            type="button"
            onClick={copyUrl}
            className="rounded-lg border border-gray-200 text-gray-600 px-3 py-2 text-xs font-medium hover:bg-gray-50 whitespace-nowrap"
          >
            {copied ? "¡Copiado!" : "Copiar URL"}
          </button>
        </div>
      </div>

      {/* Import feeds */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Importar bloqueos (OTA → Roomly)</h3>
        <p className="text-xs text-gray-400 mb-3">
          Agrega la URL iCal de tu OTA para que Roomly importe sus bloqueos automáticamente cada día.
        </p>

        {feeds.length > 0 && (
          <div className="space-y-2 mb-4">
            {feeds.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{f.nombre}</p>
                  <p className="text-xs text-gray-400 truncate">{f.url}</p>
                  {f.lastSyncedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Última sincronización:{" "}
                      {new Date(f.lastSyncedAt).toLocaleString("es-MX", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(f.id)}
                  className="ml-4 text-xs text-red-500 hover:text-red-700 shrink-0"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Nombre (ej. Booking.com)</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Booking.com"
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-xs font-medium text-gray-500 mb-1">URL del feed iCal</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://ical.booking.com/v1/export?t=..."
                required
                type="url"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? "Guardando..." : "+ Agregar feed"}
          </button>
        </form>
      </div>
    </div>
  );
}
