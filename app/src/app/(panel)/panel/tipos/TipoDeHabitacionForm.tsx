"use client";

import { useState, useRef } from "react";

type Tipo = {
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  capacidadMin?: number;
  capacidadMax?: number;
  tarifaBasePrice?: number;
  tarifaBaseModalidad?: string;
  suplementoPorPersona?: number | null;
  activo?: boolean;
  fotos?: string[];
  amenidades?: string[];
};

export function TipoDeHabitacionForm({
  action,
  tipo,
  submitLabel,
  cancelHref,
}: {
  action: (formData: FormData) => Promise<void>;
  tipo?: Tipo;
  submitLabel: string;
  cancelHref: string;
}) {
  const [fotos, setFotos] = useState<string[]>(tipo?.fotos ?? []);
  const [amenidades, setAmenidades] = useState<string[]>(tipo?.amenidades ?? []);
  const [nuevaFoto, setNuevaFoto] = useState("");
  const [nuevaAmenidad, setNuevaAmenidad] = useState("");
  const amenidadInputRef = useRef<HTMLInputElement>(null);

  function agregarFoto() {
    const url = nuevaFoto.trim();
    if (url && !fotos.includes(url)) {
      setFotos([...fotos, url]);
      setNuevaFoto("");
    }
  }

  function eliminarFoto(idx: number) {
    setFotos(fotos.filter((_, i) => i !== idx));
  }

  function agregarAmenidad() {
    const val = nuevaAmenidad.trim();
    if (val && !amenidades.includes(val)) {
      setAmenidades([...amenidades, val]);
      setNuevaAmenidad("");
      amenidadInputRef.current?.focus();
    }
  }

  function eliminarAmenidad(idx: number) {
    setAmenidades(amenidades.filter((_, i) => i !== idx));
  }

  return (
    <form action={action} className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
      {tipo?.id && <input type="hidden" name="id" value={tipo.id} />}

      {/* Nombre */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
        <input
          type="text"
          name="nombre"
          defaultValue={tipo?.nombre ?? ""}
          required
          placeholder="Ej. Suite deluxe"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea
          name="descripcion"
          rows={3}
          defaultValue={tipo?.descripcion ?? ""}
          placeholder="Describe las características de esta habitación..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Fotos */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Fotos</label>

        {/* Previsualización */}
        {fotos.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            {fotos.map((url, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden aspect-video bg-gray-100">
                <img
                  src={url}
                  alt={`Foto ${idx + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).parentElement!.classList.add("border", "border-red-200");
                  }}
                />
                <button
                  type="button"
                  onClick={() => eliminarFoto(idx)}
                  className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                {/* Inputs hidden para el array */}
                <input type="hidden" name="fotos" value={url} />
              </div>
            ))}
          </div>
        )}

        {fotos.length === 0 && (
          <div className="mb-3 rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            Sin fotos — agrega URLs de imágenes
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="url"
            value={nuevaFoto}
            onChange={(e) => setNuevaFoto(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarFoto(); } }}
            placeholder="https://... (URL de imagen)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={agregarFoto}
            className="rounded-lg border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Agregar
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Pega la URL directa de una imagen. La primera foto se muestra como principal.</p>
      </div>

      {/* Amenidades */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Amenidades</label>

        {amenidades.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {amenidades.map((a, idx) => (
              <span key={idx} className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 text-sm rounded-full px-3 py-1">
                {a}
                <button
                  type="button"
                  onClick={() => eliminarAmenidad(idx)}
                  className="text-gray-400 hover:text-gray-700 leading-none"
                >
                  ×
                </button>
                <input type="hidden" name="amenidades" value={a} />
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={amenidadInputRef}
            type="text"
            value={nuevaAmenidad}
            onChange={(e) => setNuevaAmenidad(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarAmenidad(); } }}
            placeholder="Ej. WiFi, Aire acondicionado, Vista al mar..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={agregarAmenidad}
            className="rounded-lg border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Agregar
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">Presiona Enter o "Agregar" para añadir cada amenidad.</p>
      </div>

      <hr className="border-gray-100" />

      {/* Capacidad */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cap. mínima</label>
          <input
            type="number"
            name="capacidadMin"
            defaultValue={tipo?.capacidadMin ?? 1}
            min={1}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cap. máxima</label>
          <input
            type="number"
            name="capacidadMax"
            defaultValue={tipo?.capacidadMax ?? 2}
            min={1}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Tarifa */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa base (MXN)</label>
          <input
            type="number"
            name="tarifaBasePrice"
            defaultValue={tipo?.tarifaBasePrice ?? 0}
            min={0}
            step="0.01"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
          <select
            name="tarifaBaseModalidad"
            defaultValue={tipo?.tarifaBaseModalidad ?? "POR_HABITACION"}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="POR_HABITACION">Por habitación</option>
            <option value="POR_PERSONA">Por persona</option>
            <option value="BASE_MAS_SUPLEMENTO">Base + suplemento por persona</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Suplemento por persona adicional (MXN)</label>
        <input
          type="number"
          name="suplementoPorPersona"
          defaultValue={tipo?.suplementoPorPersona ?? 0}
          min={0}
          step="0.01"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Solo aplica con modalidad "Base + suplemento".</p>
      </div>

      {/* Estado (solo en edición) */}
      {tipo?.id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select
            name="activo"
            defaultValue={tipo?.activo !== false ? "true" : "false"}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700"
        >
          {submitLabel}
        </button>
        <a
          href={cancelHref}
          className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
