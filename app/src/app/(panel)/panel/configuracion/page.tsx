import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarPropiedadAction } from "./actions";

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ guardado?: string }>;
}) {
  const usuario = await requireAdmin();

  const { guardado } = await searchParams;

  const propiedad = await prisma.propiedad.findUnique({
    where: { id: usuario.propiedadId },
  });
  if (!propiedad) redirect("/sign-in");

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Configuración del hotel</h1>

      {guardado && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Cambios guardados correctamente.
        </div>
      )}

      <form action={actualizarPropiedadAction} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del hotel</label>
          <input type="text" name="nombre" defaultValue={propiedad.nombre} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
          <textarea name="descripcion" rows={3} defaultValue={propiedad.descripcion ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" name="telefono" defaultValue={propiedad.telefono ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" name="email" defaultValue={propiedad.email ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
          <input type="text" name="direccion" defaultValue={propiedad.direccion ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Color primario (hex)</label>
          <div className="flex gap-2 items-center">
            <input type="color" name="colorPrimario" defaultValue={propiedad.colorPrimario ?? "#111827"} className="h-9 w-16 border border-gray-300 rounded-lg cursor-pointer" />
            <span className="text-xs text-gray-400">Usado en el portal de reservas</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL del portal)</label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">/p/</span>
            <input type="text" value={propiedad.slug} readOnly className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed" />
          </div>
        </div>

        <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
          Guardar cambios
        </button>
      </form>
    </div>
  );
}
