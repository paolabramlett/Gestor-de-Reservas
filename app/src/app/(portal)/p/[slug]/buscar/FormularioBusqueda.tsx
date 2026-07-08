"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatePicker } from "@/components/DatePicker";

export default function FormularioBusqueda({
  slug,
  colorPrimario = "#111827",
  fechaIngreso: initIngreso,
  fechaSalida: initSalida,
  numPersonas: initPersonas,
}: {
  slug: string;
  colorPrimario?: string;
  fechaIngreso?: string;
  fechaSalida?: string;
  numPersonas?: number;
}) {
  const router = useRouter();
  const hoy = new Date().toISOString().split("T")[0];
  const manana = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const [fechaIngreso, setFechaIngreso] = useState(initIngreso ?? hoy);
  const [fechaSalida, setFechaSalida] = useState(initSalida ?? manana);
  const [numPersonas, setNumPersonas] = useState(initPersonas ?? 2);
  const [buscando, startTransition] = useTransition();

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({
      fechaIngreso,
      fechaSalida,
      numPersonas: String(numPersonas),
    });
    startTransition(() => {
      router.push(`/p/${slug}?${params}`);
    });
  }

  return (
    <form onSubmit={buscar} className="flex flex-col sm:flex-row gap-3 items-end">
      <div className="flex-1">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Llegada</label>
        <DatePicker
          name="fechaIngreso"
          defaultValue={fechaIngreso}
          min={hoy}
          colorPrimario={colorPrimario}
          onChange={(iso) => {
            setFechaIngreso(iso);
            if (iso >= fechaSalida) {
              const next = new Date(iso + "T12:00:00");
              next.setDate(next.getDate() + 1);
              setFechaSalida(next.toISOString().split("T")[0]);
            }
          }}
        />
      </div>
      <div className="flex-1">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Salida</label>
        <DatePicker
          name="fechaSalida"
          defaultValue={fechaSalida}
          min={fechaIngreso}
          colorPrimario={colorPrimario}
          onChange={setFechaSalida}
        />
      </div>
      <div className="w-28 shrink-0">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Personas</label>
        <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden">
          <button
            type="button"
            onClick={() => setNumPersonas(Math.max(1, numPersonas - 1))}
            className="px-3 py-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors text-lg leading-none"
          >−</button>
          <span className="flex-1 text-center text-sm font-medium text-gray-900">{numPersonas}</span>
          <button
            type="button"
            onClick={() => setNumPersonas(Math.min(20, numPersonas + 1))}
            className="px-3 py-2.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors text-lg leading-none"
          >+</button>
        </div>
      </div>
      <div className="shrink-0">
        <button
          type="submit"
          disabled={buscando}
          style={{ backgroundColor: colorPrimario }}
          className="w-full sm:w-auto rounded-xl text-white px-7 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-70 transition-opacity inline-flex items-center justify-center gap-2"
        >
          {buscando && (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          )}
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </div>
    </form>
  );
}
