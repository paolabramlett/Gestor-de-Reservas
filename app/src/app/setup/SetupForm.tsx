"use client";

import { useRef, useState } from "react";
import { crearHotelAction } from "./actions";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function SetupForm({ error }: { error?: string }) {
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleNombreChange(v: string) {
    setNombre(v);
    if (!slugEditado) setSlug(slugify(v));
  }

  function handleSlugChange(v: string) {
    setSlugEditado(true);
    setSlug(slugify(v));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || pending) return;
    setPending(true);
    const fd = new FormData(formRef.current!);
    await crearHotelAction(fd);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
      {error === "nombre" && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          El nombre del hotel es obligatorio.
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Nombre del hotel <span className="text-red-500">*</span>
        </label>
        <input
          name="nombre"
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={nombre}
          onChange={(e) => handleNombreChange(e.target.value)}
          placeholder="Hotel Casa Azul"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          URL de tu portal de reservas
        </label>
        <div className="flex rounded-lg border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-gray-900 focus-within:border-transparent">
          <span className="flex items-center px-3 bg-gray-50 text-gray-400 text-sm border-r border-gray-300 shrink-0 whitespace-nowrap">
            hello-roomly.com/p/
          </span>
          <input
            name="slug"
            type="text"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="hotel-casa-azul"
            className="flex-1 px-3 py-2.5 text-sm text-gray-900 focus:outline-none bg-white min-w-0"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Esta será la dirección que compartes con tus huéspedes para que reserven en línea.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            name="telefono"
            type="tel"
            placeholder="+52 55 1234 5678"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Email de contacto <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            name="email"
            type="email"
            placeholder="hola@mihotel.com"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={!nombre.trim() || pending}
        className="w-full rounded-lg bg-gray-900 text-white py-2.5 text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {pending ? "Creando tu hotel…" : "Crear mi hotel →"}
      </button>
    </form>
  );
}
