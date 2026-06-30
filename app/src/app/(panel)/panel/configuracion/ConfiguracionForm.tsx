"use client";

import { useRef, useState } from "react";
import { actualizarPropiedadAction } from "./actions";

type Props = {
  nombre: string;
  descripcion: string;
  telefono: string;
  email: string;
  direccion: string;
  colorPrimario: string;
  slug: string;
  logoUrl: string;
};

export default function ConfiguracionForm(props: Props) {
  const [logoUrl, setLogoUrl] = useState(props.logoUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadError(null);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();

    if (!res.ok) {
      setUploadError(data.error ?? "Error al subir la imagen");
    } else {
      setLogoUrl(data.url);
    }
    setUploading(false);
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  }

  return (
    <form action={actualizarPropiedadAction} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Logo del hotel</label>
        <input type="hidden" name="logoUrl" value={logoUrl} />

        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="w-24 h-24 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M21 3H3m18 0v18M3 3v18" />
              </svg>
            )}
          </div>

          {/* Drop zone */}
          <div
            className={`flex-1 border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
              dragging ? "border-gray-400 bg-gray-50" : "border-gray-200 hover:border-gray-300"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Subiendo…
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500">Arrastra una imagen o haz clic para seleccionar</p>
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP · máx. 5 MB</p>
              </>
            )}
          </div>
        </div>

        {uploadError && (
          <p className="text-xs text-red-600 mt-2">{uploadError}</p>
        )}
        {logoUrl && (
          <button
            type="button"
            onClick={() => setLogoUrl("")}
            className="mt-2 text-xs text-red-500 hover:text-red-700"
          >
            Eliminar logo
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del hotel</label>
        <input type="text" name="nombre" defaultValue={props.nombre} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
        <textarea name="descripcion" rows={3} defaultValue={props.descripcion} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input type="tel" name="telefono" defaultValue={props.telefono} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" name="email" defaultValue={props.email} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
        <input type="text" name="direccion" defaultValue={props.direccion} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Color primario (hex)</label>
        <div className="flex gap-2 items-center">
          <input type="color" name="colorPrimario" defaultValue={props.colorPrimario} className="h-9 w-16 border border-gray-300 rounded-lg cursor-pointer" />
          <span className="text-xs text-gray-400">Usado en el portal de reservas</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL del portal)</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">/p/</span>
          <input type="text" value={props.slug} readOnly className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
        </div>
      </div>

      <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
        Guardar cambios
      </button>
    </form>
  );
}
