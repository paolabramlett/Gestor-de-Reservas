import { requireAdmin } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import {
  crearBloqueoHabitacionAction,
  eliminarBloqueoHabitacionAction,
  crearBloqueoTipoAction,
  eliminarBloqueoTipoAction,
} from "./actions";

export default async function BloqueosPage() {
  const usuario = await requireAdmin();
  
  

  const [habitaciones, tipos, bloqueosHabitacion, bloqueosTipo] = await Promise.all([
    prisma.habitacion.findMany({
      where: { propiedadId: usuario.propiedadId, activa: true },
      include: { tipoDeHabitacion: true },
      orderBy: { numero: "asc" },
    }),
    prisma.tipoDeHabitacion.findMany({
      where: { propiedadId: usuario.propiedadId, activo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.bloqueoDeHabitacion.findMany({
      where: { propiedadId: usuario.propiedadId },
      include: { habitacion: true },
      orderBy: { fechaInicio: "asc" },
    }),
    prisma.bloqueoDetipo.findMany({
      where: { propiedadId: usuario.propiedadId },
      include: { tipoDeHabitacion: true },
      orderBy: { fechaInicio: "asc" },
    }),
  ]);

  const hoy = new Date().toISOString().slice(0, 10);
  const fmt = (d: Date) => new Date(d).toLocaleDateString("es-MX");
  const isPast = (d: Date) => new Date(d) < new Date();

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-8">Bloqueos</h1>

      <div className="grid grid-cols-2 gap-8">
        {/* ── Columna izquierda: Bloqueos por habitación (5.5) ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Por habitación</h2>
          <p className="text-xs text-gray-400 mb-4">Bloquea una habitación física (mantenimiento, limpieza, etc.)</p>

          {/* Formulario nuevo */}
          <form action={crearBloqueoHabitacionAction} className="space-y-3 bg-white rounded-lg border border-gray-200 p-4 mb-4">
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
                <input type="date" name="fechaInicio" defaultValue={hoy} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fin</label>
                <input type="date" name="fechaFin" defaultValue={hoy} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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

          {/* Lista */}
          <div className="space-y-2">
            {bloqueosHabitacion.length === 0 && (
              <p className="text-sm text-gray-400">Sin bloqueos por habitación.</p>
            )}
            {bloqueosHabitacion.map((b) => (
              <div
                key={b.id}
                className={`bg-white rounded-lg border px-4 py-3 flex items-center justify-between ${isPast(b.fechaFin) ? "border-gray-100 opacity-60" : "border-gray-200"}`}
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">Hab. {b.habitacion.numero}</div>
                  <div className="text-xs text-gray-500">
                    {fmt(b.fechaInicio)} → {fmt(b.fechaFin)}
                    {b.motivo && <span className="ml-2 text-gray-400">· {b.motivo}</span>}
                  </div>
                </div>
                <form action={eliminarBloqueoHabitacionAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <button type="submit" className="text-xs text-red-500 hover:underline">
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>

        {/* ── Columna derecha: Bloqueos por tipo (5.6) ── */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Por tipo de habitación</h2>
          <p className="text-xs text-gray-400 mb-4">Bloquea todas las habitaciones de un tipo (cierre temporal, temporada cerrada, etc.)</p>

          {/* Formulario nuevo */}
          <form action={crearBloqueoTipoAction} className="space-y-3 bg-white rounded-lg border border-gray-200 p-4 mb-4">
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
                <input type="date" name="fechaInicio" defaultValue={hoy} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Fin</label>
                <input type="date" name="fechaFin" defaultValue={hoy} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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

          {/* Lista */}
          <div className="space-y-2">
            {bloqueosTipo.length === 0 && (
              <p className="text-sm text-gray-400">Sin bloqueos por tipo.</p>
            )}
            {bloqueosTipo.map((b) => (
              <div
                key={b.id}
                className={`bg-white rounded-lg border px-4 py-3 flex items-center justify-between ${isPast(b.fechaFin) ? "border-gray-100 opacity-60" : "border-gray-200"}`}
              >
                <div>
                  <div className="text-sm font-medium text-gray-900">{b.tipoDeHabitacion.nombre}</div>
                  <div className="text-xs text-gray-500">
                    {fmt(b.fechaInicio)} → {fmt(b.fechaFin)}
                    {b.motivo && <span className="ml-2 text-gray-400">· {b.motivo}</span>}
                  </div>
                </div>
                <form action={eliminarBloqueoTipoAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <button type="submit" className="text-xs text-red-500 hover:underline">
                    Eliminar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
