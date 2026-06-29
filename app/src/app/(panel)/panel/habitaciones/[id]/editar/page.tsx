import { getCurrentUsuario } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarHabitacionAction } from "../../actions";

export default async function EditarHabitacionPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const { id } = await params;

  const habitacion = await prisma.habitacion.findFirst({
    where: { id, propiedadId: usuario.propiedadId },
  });
  if (!habitacion) notFound();

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="p-8 max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Editar habitación {habitacion.numero}</h1>

      <form action={actualizarHabitacionAction} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
        <input type="hidden" name="id" value={habitacion.id} />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número / identificador</label>
          <input type="text" name="numero" defaultValue={habitacion.numero} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de habitación</label>
          <select name="tipoDeHabitacionId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            {tipos.map((t) => (
              <option key={t.id} value={t.id} selected={t.id === habitacion.tipoDeHabitacionId}>{t.nombre}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea name="descripcion" rows={2} defaultValue={habitacion.descripcion ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
          <select name="activa" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="true" selected={habitacion.activa}>Activa</option>
            <option value="false" selected={!habitacion.activa}>Inactiva</option>
          </select>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
            Guardar cambios
          </button>
          <a href="/panel/habitaciones" className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50">
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
