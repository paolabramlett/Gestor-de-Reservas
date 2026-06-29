import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { crearTemporadaAction } from "../actions";

export default async function NuevaTemporadaPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    orderBy: { nombre: "asc" },
  });

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nueva temporada</h1>

      <form action={crearTemporadaAction} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input type="text" name="nombre" required placeholder="Ej. Temporada alta 2026" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de habitación</label>
          <select name="tipoDeHabitacionId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Seleccionar...</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
            <input type="date" name="fechaInicio" defaultValue={hoy} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
            <input type="date" name="fechaFin" defaultValue={hoy} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio (MXN)</label>
            <input type="number" name="precio" defaultValue={0} min={0} step="0.01" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
            <select name="modalidad" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="POR_HABITACION">Por habitación</option>
              <option value="POR_PERSONA">Por persona</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
            Crear temporada
          </button>
          <a href="/panel/temporadas" className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
