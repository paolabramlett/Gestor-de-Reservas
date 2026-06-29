import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { crearTipoAction } from "../actions";

export default async function NuevoTipoPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nuevo tipo de habitación</h1>

      <form action={crearTipoAction} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input type="text" name="nombre" required placeholder="Ej. Suite deluxe" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea name="descripcion" rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cap. mínima</label>
            <input type="number" name="capacidadMin" defaultValue={1} min={1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cap. máxima</label>
            <input type="number" name="capacidadMax" defaultValue={2} min={1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa base (MXN)</label>
            <input type="number" name="tarifaBasePrice" defaultValue={0} min={0} step="0.01" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
            <select name="tarifaBaseModalidad" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="POR_HABITACION">Por habitación</option>
              <option value="POR_PERSONA">Por persona</option>
              <option value="BASE_MAS_SUPLEMENTO">Base + suplemento por persona</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Suplemento por persona adicional (MXN)</label>
          <input type="number" name="suplementoPorPersona" defaultValue={0} min={0} step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">Solo aplica con modalidad "Base + suplemento". Ej: base $1,000 + $200/pax extra → 3 personas = $1,400</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
            Crear tipo
          </button>
          <a href="/panel/tipos" className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
