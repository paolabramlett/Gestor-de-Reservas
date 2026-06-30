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

type FotoItem = { url: string; uploading?: boolean; error?: string };

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
  const [fotos, setFotos] = useState<FotoItem[]>(
    (tipo?.fotos ?? []).map((url) => ({ url }))
  );
  const [amenidades, setAmenidades] = useState<string[]>(tipo?.amenidades ?? []);
  const [nuevaAmenidad, setNuevaAmenidad] = useState("");
  const [draggingOver, setDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const amenidadInputRef = useRef<HTMLInputElement>(null);

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    // Add placeholders immediately
    const placeholders: FotoItem[] = arr.map(() => ({ url: "", uploading: true }));
    setFotos((prev) => [...prev, ...placeholders]);

    await Promise.all(
      arr.map(async (file, i) => {
        const fd = new FormData();
        fd.append("file", file);
        try {
          const res = await fetch("/api/upload", { method: "POST", body: fd });
          const data = await res.json();
          setFotos((prev) => {
            const idx = prev.findIndex((f, fi) => f.uploading && fi >= prev.length - arr.length + i);
            if (idx === -1) return prev;
            const next = [...prev];
            next[idx] = res.ok ? { url: data.url } : { url: "", error: data.error ?? "Error al subir" };
            return next;
          });
        } catch {
          setFotos((prev) => {
            const next = [...prev];
            const idx = next.findIndex((f) => f.uploading);
            if (idx !== -1) next[idx] = { url: "", error: "Error de red" };
            return next;
          });
        }
      })
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDraggingOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  function eliminarFoto(idx: number) {
    setFotos((prev) => prev.filter((_, i) => i !== idx));
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
    setAmenidades((prev) => prev.filter((_, i) => i !== idx));
  }

  const fotasValidas = fotos.filter((f) => f.url && !f.uploading && !f.error);

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

        {/* Zona de drop */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mb-3 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center py-8 px-4 ${
            draggingOver
              ? "border-gray-400 bg-gray-50"
              : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          }`}
        >
          <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-gray-500">
            Arrastra imágenes aquí o <span className="font-medium text-gray-700 underline underline-offset-2">selecciona archivos</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · máx. 5MB por imagen</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Grid de previews */}
        {fotos.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {fotos.map((foto, idx) => (
              <div key={idx} className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100">
                {foto.uploading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </div>
                ) : foto.error ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 px-2 text-center">
                    <svg className="w-5 h-5 text-red-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                    </svg>
                    <p className="text-xs text-red-500">{foto.error}</p>
                  </div>
                ) : (
                  <img src={foto.url} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                )}

                {!foto.uploading && (
                  <button
                    type="button"
                    onClick={() => eliminarFoto(idx)}
                    className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                )}

                {/* Primera foto: badge "Principal" */}
                {idx === 0 && foto.url && !foto.uploading && (
                  <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded-md">
                    Principal
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden inputs para el submit */}
        {fotasValidas.map((f, i) => (
          <input key={i} type="hidden" name="fotos" value={f.url} />
        ))}
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
          <input type="number" name="capacidadMin" defaultValue={tipo?.capacidadMin ?? 1} min={1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cap. máxima</label>
          <input type="number" name="capacidadMax" defaultValue={tipo?.capacidadMax ?? 2} min={1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Tarifa */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa base (MXN)</label>
          <input type="number" name="tarifaBasePrice" defaultValue={tipo?.tarifaBasePrice ?? 0} min={0} step="0.01" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
          <select name="tarifaBaseModalidad" defaultValue={tipo?.tarifaBaseModalidad ?? "POR_HABITACION"} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="POR_HABITACION">Por habitación</option>
            <option value="POR_PERSONA">Por persona</option>
            <option value="BASE_MAS_SUPLEMENTO">Base + suplemento por persona</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Suplemento por persona adicional (MXN)</label>
        <input type="number" name="suplementoPorPersona" defaultValue={tipo?.suplementoPorPersona ?? 0} min={0} step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <p className="text-xs text-gray-400 mt-1">Solo aplica con modalidad "Base + suplemento".</p>
      </div>

      {/* Estado (solo en edición) */}
      {tipo?.id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select name="activo" defaultValue={tipo?.activo !== false ? "true" : "false"} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </select>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
          {submitLabel}
        </button>
        <a href={cancelHref} className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </a>
      </div>
    </form>
  );
}
