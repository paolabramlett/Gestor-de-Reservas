"use client";

import { useRef, useState } from "react";
import { iniciarCheckoutAction } from "./actions";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

type Plan = "ESENCIAL" | "PRO";

const PLANES: {
  id: Plan;
  nombre: string;
  precio: string;
  descripcion: string;
  features: string[];
  destacado?: boolean;
}[] = [
  {
    id: "ESENCIAL",
    nombre: "Esencial",
    precio: "$399 MXN/mes",
    descripcion: "Gestión completa de tu hotel desde el panel.",
    features: [
      "Panel de reservas y calendario",
      "Registro manual de pagos",
      "Reportes de ocupación",
      "Hasta 3 usuarios",
    ],
  },
  {
    id: "PRO",
    nombre: "Pro",
    precio: "$999 MXN/mes",
    descripcion: "Todo lo Esencial + cobros online para tus huéspedes.",
    features: [
      "Todo lo del plan Esencial",
      "Portal de reservas online",
      "Solicitar pago con tarjeta",
      "Links de pago por WhatsApp",
    ],
    destacado: true,
  },
];

export function SetupForm({
  error,
  cancelado,
}: {
  error?: string;
  cancelado?: boolean;
}) {
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditado, setSlugEditado] = useState(false);
  const [plan, setPlan] = useState<Plan>("ESENCIAL");
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
    fd.set("plan", plan);
    await iniciarCheckoutAction(fd);
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {cancelado && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Cancelaste el pago. Puedes intentarlo de nuevo cuando quieras.
        </p>
      )}
      {error === "nombre" && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          El nombre del hotel es obligatorio.
        </p>
      )}
      {error === "pago" && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Hubo un problema con el pago. Inténtalo de nuevo.
        </p>
      )}

      {/* Plan selection */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Elige tu plan</p>
        <div className="grid grid-cols-2 gap-3">
          {PLANES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id)}
              className={`relative text-left rounded-xl border-2 p-4 transition-all ${
                plan === p.id
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-900 hover:border-gray-400"
              }`}
            >
              {p.destacado && (
                <span
                  className={`absolute -top-2.5 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    plan === p.id
                      ? "bg-yellow-400 text-gray-900"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  RECOMENDADO
                </span>
              )}
              <div className="font-semibold text-sm mb-0.5">{p.nombre}</div>
              <div
                className={`text-base font-bold mb-2 ${plan === p.id ? "text-white" : "text-gray-900"}`}
              >
                {p.precio}
              </div>
              <ul className="space-y-1">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className={`text-xs flex gap-1.5 ${plan === p.id ? "text-gray-300" : "text-gray-500"}`}
                  >
                    <span className={plan === p.id ? "text-yellow-400" : "text-green-500"}>
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>
      </div>

      {/* Hotel fields */}
      <div className="space-y-4">
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
            Esta será la dirección que compartes con tus huéspedes para reservar en línea.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Teléfono{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
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
              Email de contacto{" "}
              <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <input
              name="email"
              type="email"
              placeholder="hola@mihotel.com"
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!nombre.trim() || pending}
        className="w-full rounded-lg bg-gray-900 text-white py-2.5 text-sm font-semibold hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {pending
          ? "Redirigiendo a pago seguro…"
          : `Continuar con plan ${plan === "PRO" ? "Pro" : "Esencial"} →`}
      </button>

      <p className="text-center text-xs text-gray-400">
        🔒 Pago seguro procesado por Stripe. Cancela cuando quieras.
      </p>
    </form>
  );
}
