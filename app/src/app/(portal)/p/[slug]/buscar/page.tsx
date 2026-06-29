import { getPropiedadBySlug } from "@/lib/auth";
import { buscarDisponibilidad } from "@/lib/negocio/disponibilidad";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function BuscarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fechaIngreso?: string; fechaSalida?: string; numPersonas?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const propiedad = await getPropiedadBySlug(slug);
  if (!propiedad) notFound();

  const fechaIngreso = sp.fechaIngreso ? new Date(sp.fechaIngreso) : new Date();
  const fechaSalida = sp.fechaSalida ? new Date(sp.fechaSalida) : new Date();
  const numPersonas = Number(sp.numPersonas ?? 2);

  const tipos = await buscarDisponibilidad(propiedad.id, fechaIngreso, fechaSalida, numPersonas);

  const resultados = await Promise.all(
    tipos.map(async (tipo) => {
      const { total, desglose } = await calcularTotalReserva(
        tipo.tipoDeHabitacionId,
        fechaIngreso,
        fechaSalida,
        numPersonas
      );
      return { ...tipo, totalMxn: total, desglose };
    })
  );

  const noches = Math.round((fechaSalida.getTime() - fechaIngreso.getTime()) / 86400000);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <p className="text-sm text-gray-500 mb-6">
        {noches} noche{noches !== 1 ? "s" : ""} · {numPersonas} persona{numPersonas !== 1 ? "s" : ""}
        {" · "}
        {fechaIngreso.toLocaleDateString("es-MX")} → {fechaSalida.toLocaleDateString("es-MX")}
      </p>

      {resultados.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-500">No hay habitaciones disponibles para las fechas seleccionadas.</p>
          <Link href={`/p/${slug}`} className="mt-4 inline-block text-sm underline text-gray-700">
            Cambiar fechas
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {resultados.map((tipo) => (
            <div key={tipo.tipoDeHabitacionId} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              {tipo.fotos[0] && (
                <img src={tipo.fotos[0]} alt={tipo.nombre} className="w-full h-48 object-cover rounded-lg mb-4" />
              )}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{tipo.nombre}</h3>
                  {tipo.descripcion && (
                    <p className="text-sm text-gray-500 mt-1">{tipo.descripcion}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">
                    Hasta {tipo.capacidadMax} personas · {tipo.habitacionesDisponibles} disponible{tipo.habitacionesDisponibles !== 1 ? "s" : ""}
                    {tipo.habitacionesDisponibles <= 2 && (
                      <span className="ml-2 text-amber-600 font-medium">¡Pocas unidades!</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    ${tipo.totalMxn.toLocaleString("es-MX")} MXN
                  </p>
                  <p className="text-xs text-gray-400">total {noches} noche{noches !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Link
                  href={`/p/${slug}/reservar?tipoId=${tipo.tipoDeHabitacionId}&fechaIngreso=${sp.fechaIngreso}&fechaSalida=${sp.fechaSalida}&numPersonas=${numPersonas}`}
                  className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Reservar
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
