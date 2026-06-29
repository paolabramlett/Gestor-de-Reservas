import { getCurrentUsuario } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarTipoAction } from "../../actions";

export default async function EditarTipoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const { id } = await params;

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id, propiedadId: usuario.propiedadId },
  });
  if (!tipo) notFound();

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Editar tipo: {tipo.nombre}</h1>

      <form action={actualizarTipoAction} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
        <input type="hidden" name="id" value={tipo.id} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
          <input type="text" name="nombre" defaultValue={tipo.nombre} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea name="descripcion" rows={2} defaultValue={tipo.descripcion ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cap. mínima</label>
            <input type="number" name="capacidadMin" defaultValue={tipo.capacidadMin} min={1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cap. máxima</label>
            <input type="number" name="capacidadMax" defaultValue={tipo.capacidadMax} min={1} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa base (MXN)</label>
            <input type="number" name="tarifaBasePrice" defaultValue={Number(tipo.tarifaBasePrice)} min={0} step="0.01" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Modalidad</label>
            <select name="tarifaBaseModalidad" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="POR_HABITACION" selected={tipo.tarifaBaseModalidad === "POR_HABITACION"}>Por habitación</option>
              <option value="POR_PERSONA" selected={tipo.tarifaBaseModalidad === "POR_PERSONA"}>Por persona</option>
              <option value="BASE_MAS_SUPLEMENTO" selected={tipo.tarifaBaseModalidad === "BASE_MAS_SUPLEMENTO"}>Base + suplemento por persona</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Suplemento por persona adicional (MXN)</label>
          <input type="number" name="suplementoPorPersona" defaultValue={tipo.suplementoPorPersona ? Number(tipo.suplementoPorPersona) : 0} min={0} step="0.01" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">Solo aplica con modalidad "Base + suplemento". Ej: base $1,000 + $200/pax extra → 3 personas = $1,400</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select name="activo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="true" selected={tipo.activo}>Activo</option>
            <option value="false" selected={!tipo.activo}>Inactivo</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
            Guardar cambios
          </button>
          <a href="/panel/tipos" className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
