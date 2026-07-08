import { requireAdmin } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { eliminarTemporadaAction } from "./actions";

export default async function TemporadasPage() {
  const usuario = await requireAdmin();
  
  

  const temporadas = await prisma.temporada.findMany({
    where: { propiedadId: usuario.propiedadId },
    include: { tipoDeHabitacion: true },
    orderBy: [{ fechaInicio: "asc" }],
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Temporadas</h1>
        <Link href="/panel/temporadas/nueva" className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
          + Nueva temporada
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Inicio</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fin</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Precio MXN</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {temporadas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No hay temporadas configuradas
                </td>
              </tr>
            )}
            {temporadas.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{t.nombre}</td>
                <td className="px-4 py-3 text-gray-700">{t.tipoDeHabitacion.nombre}</td>
                <td className="px-4 py-3 text-gray-700">{new Date(t.fechaInicio).toLocaleDateString("es-MX")}</td>
                <td className="px-4 py-3 text-gray-700">{new Date(t.fechaFin).toLocaleDateString("es-MX")}</td>
                <td className="px-4 py-3 text-gray-700">
                  ${Number(t.precio).toLocaleString("es-MX")}
                  {t.modalidad === "BASE_MAS_SUPLEMENTO" ? (
                    <span className="ml-1 text-xs text-gray-400">
                      base + ${Number(t.suplementoPorPersona ?? 0).toLocaleString("es-MX")}/pax adicional
                    </span>
                  ) : (
                    <span className="ml-1 text-xs text-gray-400">/{t.modalidad === "POR_HABITACION" ? "hab" : "pax"}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right flex gap-3 justify-end">
                  <Link href={`/panel/temporadas/${t.id}/editar`} className="text-sm text-blue-600 hover:underline">
                    Editar
                  </Link>
                  <form action={eliminarTemporadaAction} className="inline">
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="text-sm text-red-500 hover:underline">
                      Eliminar
                    </button>
                  </form>
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
