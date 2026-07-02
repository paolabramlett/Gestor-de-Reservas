import { requireAdmin } from "@/lib/auth";

import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function TiposPage() {
  const usuario = await requireAdmin();
  
  

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId },
    include: { _count: { select: { habitaciones: true, reservas: true } } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Tipos de habitación</h1>
        <Link href="/panel/tipos/nueva" className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
          + Nuevo tipo
        </Link>
      </div>

      <div className="grid gap-4">
        {tipos.length === 0 && (
          <p className="text-sm text-gray-400">No hay tipos de habitación configurados.</p>
        )}
        {tipos.map((t) => (
          <div key={t.id} className="bg-white rounded-lg border border-gray-200 p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{t.nombre}</span>
                {!t.activo && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Inactivo</span>}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Cap. {t.capacidadMin}–{t.capacidadMax} · ${Number(t.tarifaBasePrice).toLocaleString("es-MX")} MXN
                {" "}({t.tarifaBaseModalidad === "POR_HABITACION" ? "por habitación" : "por persona"})
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {t._count.habitaciones} habitaciones · {t._count.reservas} reservas
              </div>
            </div>
            <Link href={`/panel/tipos/${t.id}/editar`} className="text-sm text-blue-600 hover:underline">
              Editar
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
