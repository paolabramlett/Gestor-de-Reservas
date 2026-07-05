"use client";

import { useState } from "react";

type Tipo = { id: string; nombre: string };

export function TemporadaForm({
  action,
  tipos,
  defaults,
}: {
  action: (formData: FormData) => Promise<void>;
  tipos: Tipo[];
  defaults?: {
    id?: string;
    nombre?: string;
    tipoDeHabitacionId?: string;
    fechaInicio?: string;
    fechaFin?: string;
    precio?: number;
    modalidad?: string;
    suplementoPorPersona?: number | null;
  };
}) {
  const [modalidad, setModalidad] = useState(defaults?.modalidad ?? "POR_HABITACION");

  return (
    <form action={action} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input
          type="text"
          name="nombre"
          required
          defaultValue={defaults?.nombre}
          placeholder="Ej. Temporada alta 2026"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de habitación</label>
        <select
          name="tipoDeHabitacionId"
          required
          defaultValue={defaults?.tipoDeHabitacionId ?? ""}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          {!defaults?.tipoDeHabitacionId && <option value="">Seleccionar...</option>}
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
          <input
            type="date"
            name="fechaInicio"
            defaultValue={defaults?.fechaInicio}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
          <input
            type="date"
            name="fechaFin"
            defaultValue={defaults?.fechaFin}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {modalidad === "BASE_MAS_SUPLEMENTO" ? "Precio base (MXN)" : "Precio (MXN)"}
          </label>
          <input
            type="number"
            name="precio"
            defaultValue={defaults?.precio ?? 0}
            min={0}
            step="0.01"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
          <select
            name="modalidad"
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="POR_HABITACION">Por habitación</option>
            <option value="POR_PERSONA">Por persona</option>
            <option value="BASE_MAS_SUPLEMENTO">Base + suplemento por persona</option>
          </select>
        </div>
      </div>

      {modalidad === "BASE_MAS_SUPLEMENTO" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Suplemento por persona adicional (MXN)
          </label>
          <input
            type="number"
            name="suplementoPorPersona"
            defaultValue={defaults?.suplementoPorPersona ?? 0}
            min={0}
            step="0.01"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-gray-400 mt-1">
            Total = precio base + (suplemento × número de personas)
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700"
        >
          {defaults?.id ? "Guardar cambios" : "Crear temporada"}
        </button>
        <a
          href="/panel/temporadas"
          className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
