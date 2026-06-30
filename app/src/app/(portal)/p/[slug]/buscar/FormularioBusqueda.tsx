"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function FormularioBusqueda({
  slug,
  colorPrimario = "#111827",
}: {
  slug: string;
  colorPrimario?: string;
}) {
  const router = useRouter();
  const hoy = new Date().toISOString().split("T")[0];
  const manana = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [fechaIngreso, setFechaIngreso] = useState(hoy);
  const [fechaSalida, setFechaSalida] = useState(manana);
  const [numPersonas, setNumPersonas] = useState(2);

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ fechaIngreso, fechaSalida, numPersonas: String(numPersonas) });
    router.push(`/p/${slug}/buscar?${params}`);
  }

  return (
    <form onSubmit={buscar} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-500 mb-1">Llegada</label>
        <input
          type="date"
          value={fechaIngreso}
          min={hoy}
          onChange={(e) => setFechaIngreso(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ "--tw-ring-color": colorPrimario } as React.CSSProperties}
          required
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-500 mb-1">Salida</label>
        <input
          type="date"
          value={fechaSalida}
          min={fechaIngreso}
          onChange={(e) => setFechaSalida(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ "--tw-ring-color": colorPrimario } as React.CSSProperties}
          required
        />
      </div>
      <div className="w-28 shrink-0">
        <label className="block text-xs font-medium text-gray-500 mb-1">Personas</label>
        <input
          type="number"
          value={numPersonas}
          min={1}
          max={20}
          onChange={(e) => setNumPersonas(Number(e.target.value))}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ "--tw-ring-color": colorPrimario } as React.CSSProperties}
          required
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          style={{ backgroundColor: colorPrimario }}
          className="w-full sm:w-auto rounded-xl text-white px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Buscar
        </button>
      </div>
    </form>
  );
}
