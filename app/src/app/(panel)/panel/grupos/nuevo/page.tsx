import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { crearGrupoAction } from "../actions";

export default async function NuevoGrupoPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nuevo grupo</h1>

      <form action={crearGrupoAction} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del grupo</label>
          <input
            type="text"
            name="nombre"
            required
            placeholder="Ej. Familia García, Grupo boda julio"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas <span className="text-gray-400 font-normal">(opcional)</span></label>
          <textarea
            name="notas"
            rows={3}
            placeholder="Ocasión especial, requerimientos, contacto principal..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
          />
        </div>
        <p className="text-xs text-gray-400">
          Después de crear el grupo podrás agregar habitaciones y vincular reservas existentes.
        </p>
        <div className="flex gap-3 pt-1">
          <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
            Crear grupo
          </button>
          <a href="/panel/grupos" className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
