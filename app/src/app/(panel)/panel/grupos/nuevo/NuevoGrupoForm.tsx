"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { crearGrupoConHabitacionesAction, HabitacionInput } from "../actions";
import { calcularTotalPreviewAction } from "../../reservas/actions";

type Tipo = { id: string; nombre: string; capacidadMin: number; capacidadMax: number };

type HabitacionSlot = HabitacionInput & {
  _id: number;
  _precio: number | null;
  _loadingPrecio: boolean;
};

let nextId = 1;

function slotVacio(hoy: string, manana: string, tipoId: string): HabitacionSlot {
  return {
    _id: nextId++,
    tipoDeHabitacionId: tipoId,
    fechaIngreso: hoy,
    fechaSalida: manana,
    numPersonas: 2,
    nombre: "",
    email: "",
    telefono: "",
    estadoDePago: "PENDIENTE",
    montoAnticipo: null,
    notas: "",
    _precio: null,
    _loadingPrecio: false,
  };
}

export function NuevoGrupoForm({
  tipos,
  hoy,
  manana,
}: {
  tipos: Tipo[];
  hoy: string;
  manana: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [notas, setNotas] = useState("");
  const [habitaciones, setHabitaciones] = useState<HabitacionSlot[]>([
    slotVacio(hoy, manana, tipos[0]?.id ?? ""),
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback((id: number, patch: Partial<HabitacionSlot>) => {
    setHabitaciones((prev) =>
      prev.map((h) => (h._id === id ? { ...h, ...patch, _precio: "_precio" in patch ? patch._precio ?? null : null } : h))
    );
  }, []);

  const calcularPrecio = async (slot: HabitacionSlot) => {
    if (!slot.fechaIngreso || !slot.fechaSalida || slot.fechaSalida <= slot.fechaIngreso) return;
    update(slot._id, { _loadingPrecio: true });
    const { total } = await calcularTotalPreviewAction(
      slot.tipoDeHabitacionId,
      slot.fechaIngreso,
      slot.fechaSalida,
      slot.numPersonas
    );
    update(slot._id, { _loadingPrecio: false, _precio: total });
  };

  const agregarHabitacion = () => {
    setHabitaciones((prev) => [
      ...prev,
      slotVacio(
        prev[prev.length - 1]?.fechaIngreso ?? hoy,
        prev[prev.length - 1]?.fechaSalida ?? manana,
        tipos[0]?.id ?? ""
      ),
    ]);
  };

  const eliminarHabitacion = (id: number) => {
    setHabitaciones((prev) => prev.filter((h) => h._id !== id));
  };

  const copiarFechas = (id: number) => {
    const origen = habitaciones.find((h) => h._id === id);
    if (!origen) return;
    setHabitaciones((prev) =>
      prev.map((h) =>
        h._id !== id
          ? { ...h, fechaIngreso: origen.fechaIngreso, fechaSalida: origen.fechaSalida, _precio: null }
          : h
      )
    );
  };

  const totalGeneral = habitaciones.reduce((s, h) => s + (h._precio ?? 0), 0);
  const todosConPrecio = habitaciones.every((h) => h._precio !== null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate
    for (let i = 0; i < habitaciones.length; i++) {
      const h = habitaciones[i];
      if (!h.nombre.trim()) { setError(`Habitación ${i + 1}: el nombre del huésped es obligatorio`); return; }
      if (!h.email.trim()) { setError(`Habitación ${i + 1}: el correo es obligatorio`); return; }
      if (!h.fechaIngreso || !h.fechaSalida) { setError(`Habitación ${i + 1}: las fechas son obligatorias`); return; }
      if (h.fechaSalida <= h.fechaIngreso) { setError(`Habitación ${i + 1}: la salida debe ser posterior al ingreso`); return; }
    }

    setLoading(true);
    const result = await crearGrupoConHabitacionesAction(nombre, notas, habitaciones);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    router.push(`/panel/grupos/${result.grupoId}?success=${encodeURIComponent("Grupo creado")}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Datos del grupo */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Datos del grupo</h2>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del grupo <span className="text-red-400">*</span></label>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            placeholder="Ej. Familia García, Grupo boda julio, Convención ACME"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas <span className="text-gray-400 font-normal">(opcional)</span></label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Ocasión especial, requerimientos, contacto principal..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
      </div>

      {/* Habitaciones */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Habitaciones <span className="ml-1 text-gray-400 font-normal">({habitaciones.length})</span>
          </h2>
          {habitaciones.length > 1 && todosConPrecio && (
            <span className="text-sm font-semibold text-gray-900">
              Total: ${totalGeneral.toLocaleString("es-MX")} MXN
            </span>
          )}
        </div>

        {habitaciones.map((h, i) => (
          <div key={h._id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header de la habitación */}
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-semibold text-gray-700">Habitación {i + 1}</span>
              <div className="flex items-center gap-3">
                {h._precio !== null && (
                  <span className="text-sm font-semibold text-gray-900">
                    ${h._precio.toLocaleString("es-MX")} MXN
                  </span>
                )}
                {habitaciones.length > 1 && i === 0 && (
                  <button
                    type="button"
                    onClick={() => copiarFechas(h._id)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Copiar fechas a todas
                  </button>
                )}
                {habitaciones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => eliminarHabitacion(h._id)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Tipo + personas */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de habitación</label>
                  <select
                    value={h.tipoDeHabitacionId}
                    onChange={(e) => update(h._id, { tipoDeHabitacionId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {tipos.map((t) => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Personas</label>
                  <input
                    type="number"
                    min={1}
                    value={h.numPersonas}
                    onChange={(e) => update(h._id, { numPersonas: Number(e.target.value) })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Check-in</label>
                  <input
                    type="date"
                    required
                    value={h.fechaIngreso}
                    onChange={(e) => update(h._id, { fechaIngreso: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Check-out</label>
                  <input
                    type="date"
                    required
                    value={h.fechaSalida}
                    onChange={(e) => update(h._id, { fechaSalida: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Huésped */}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del huésped <span className="text-red-400">*</span></label>
                  <input
                    required
                    value={h.nombre}
                    onChange={(e) => update(h._id, { nombre: e.target.value })}
                    placeholder="Nombre completo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Correo <span className="text-red-400">*</span></label>
                  <input
                    type="email"
                    required
                    value={h.email}
                    onChange={(e) => update(h._id, { email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={h.telefono}
                    onChange={(e) => update(h._id, { telefono: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Estado de pago + notas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Estado de pago</label>
                  <select
                    value={h.estadoDePago}
                    onChange={(e) =>
                      update(h._id, {
                        estadoDePago: e.target.value as HabitacionInput["estadoDePago"],
                        montoAnticipo: e.target.value === "ANTICIPO_PAGADO" ? h.montoAnticipo : null,
                        _precio: h._precio,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="ANTICIPO_PAGADO">Anticipo pagado</option>
                    <option value="PAGADO_COMPLETO">Pagado completo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notas</label>
                  <input
                    value={h.notas}
                    onChange={(e) => update(h._id, { notas: e.target.value })}
                    placeholder="Cama extra, vista al mar..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {h.estadoDePago === "ANTICIPO_PAGADO" && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Monto del anticipo (MXN)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    max={h._precio ?? undefined}
                    value={h.montoAnticipo ?? ""}
                    onChange={(e) =>
                      update(h._id, {
                        montoAnticipo: e.target.value ? Number(e.target.value) : null,
                        _precio: h._precio,
                      })
                    }
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                  {h._precio !== null && !!h.montoAnticipo && h.montoAnticipo > 0 && (
                    <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm space-y-1">
                      <div className="flex justify-between text-gray-600">
                        <span>Total habitación</span>
                        <span>${h._precio.toLocaleString("es-MX")} MXN</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Anticipo pagado</span>
                        <span>− ${h.montoAnticipo.toLocaleString("es-MX")} MXN</span>
                      </div>
                      <div className="flex justify-between font-semibold text-amber-800 pt-1 border-t border-amber-200">
                        <span>Resta al check-in</span>
                        <span>${Math.max(0, h._precio - h.montoAnticipo).toLocaleString("es-MX")} MXN</span>
                      </div>
                    </div>
                  )}
                  {h._precio === null && (
                    <p className="text-xs text-gray-400 mt-1">Calcula el precio de la habitación para ver el saldo pendiente.</p>
                  )}
                </div>
              )}

              {/* Calcular precio */}
              <button
                type="button"
                onClick={() => calcularPrecio(h)}
                disabled={h._loadingPrecio || !h.fechaIngreso || !h.fechaSalida || h.fechaSalida <= h.fechaIngreso}
                className="w-full rounded-lg bg-gray-50 border border-gray-200 text-gray-600 py-2 text-sm font-medium hover:bg-gray-100 disabled:opacity-50"
              >
                {h._loadingPrecio ? "Calculando..." : h._precio !== null ? `$${h._precio.toLocaleString("es-MX")} MXN — Recalcular` : "Calcular precio"}
              </button>
            </div>
          </div>
        ))}

        {/* Agregar habitación */}
        <button
          type="button"
          onClick={agregarHabitacion}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 text-gray-500 py-4 text-sm font-medium hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar otra habitación
        </button>
      </div>

      {/* Footer */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex gap-3 pb-8">
        <button
          type="submit"
          disabled={loading || !nombre.trim()}
          className="rounded-lg bg-gray-900 text-white px-6 py-2.5 text-sm font-semibold hover:bg-gray-700 disabled:opacity-50 flex items-center gap-2"
        >
          {loading && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          {loading ? "Creando grupo..." : `Crear grupo${habitaciones.length > 1 ? ` (${habitaciones.length} habitaciones)` : ""}`}
        </button>
        <a href="/panel/grupos" className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2.5 text-sm font-medium hover:bg-gray-50">
          Cancelar
        </a>
      </div>
    </form>
  );
}
