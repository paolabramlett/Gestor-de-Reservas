"use client";

import { DatePicker } from "@/components/DatePicker";

const hoy = new Date().toISOString().slice(0, 10);

export function BloqueoHabitacionForm({
  action,
  habitaciones,
}: {
  action: (formData: FormData) => Promise<void>;
  habitaciones: { id: string; numero: string; tipoDeHabitacion: { nombre: string } }[];
}) {
  return (
    <form action={action} className="space-y-3 bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Habitación</label>
        <select name="habitacionId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Seleccionar...</option>
          {habitaciones.map((h) => (
            <option key={h.id} value={h.id}>
              {h.numero} — {h.tipoDeHabitacion.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Inicio</label>
          <DatePicker name="fechaInicio" defaultValue={hoy} required />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Fin</label>
          <DatePicker name="fechaFin" defaultValue={hoy} required />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Motivo (opcional)</label>
        <input type="text" name="motivo" placeholder="Ej. Mantenimiento" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button type="submit" className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-700">
        + Agregar bloqueo
      </button>
    </form>
  );
}

export function BloqueoTipoForm({
  action,
  tipos,
}: {
  action: (formData: FormData) => Promise<void>;
  tipos: { id: string; nombre: string }[];
}) {
  return (
    <form action={action} className="space-y-3 bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div>
        <label className="block text-xs text-gray-600 mb-1">Tipo de habitación</label>
        <select name="tipoDeHabitacionId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Seleccionar...</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Inicio</label>
          <DatePicker name="fechaInicio" defaultValue={hoy} required />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Fin</label>
          <DatePicker name="fechaFin" defaultValue={hoy} required />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-600 mb-1">Motivo (opcional)</label>
        <input type="text" name="motivo" placeholder="Ej. Renovación" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      <button type="submit" className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-700">
        + Agregar bloqueo
      </button>
    </form>
  );
}
