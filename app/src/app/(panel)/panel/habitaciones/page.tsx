import { requireAdmin } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function HabitacionesPage() {
  const usuario = await requireAdmin();
  
  

  const habitaciones = await prisma.habitacion.findMany({
    where: { propiedadId: usuario.propiedadId },
    include: { tipoDeHabitacion: true },
    orderBy: { numero: "asc" },
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Habitaciones</h1>
        <Link href="/panel/habitaciones/nueva" className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
          + Nueva habitación
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Número</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Descripción</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {habitaciones.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No hay habitaciones configuradas
                </td>
              </tr>
            )}
            {habitaciones.map((h) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{h.numero}</td>
                <td className="px-4 py-3 text-gray-700">{h.tipoDeHabitacion.nombre}</td>
                <td className="px-4 py-3 text-gray-500">{h.descripcion ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${h.activa ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {h.activa ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/panel/habitaciones/${h.id}/editar`} className="text-sm text-blue-600 hover:underline">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
