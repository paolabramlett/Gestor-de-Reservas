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
      const { total } = await calcularTotalReserva(
        tipo.tipoDeHabitacionId,
        fechaIngreso,
        fechaSalida,
        numPersonas
      );
      return { ...tipo, totalMxn: Number(total) };
    })
  );

  const noches = Math.round((fechaSalida.getTime() - fechaIngreso.getTime()) / 86400000);
  const colorPrimario = propiedad.colorPrimario ?? "#111827";

  const fechaIngresoFmt = fechaIngreso.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  const fechaSalidaFmt = fechaSalida.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra de búsqueda resumida */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm text-gray-700">
            <span className="font-medium">{fechaIngresoFmt} → {fechaSalidaFmt}</span>
            <span className="text-gray-300">·</span>
            <span>{noches} noche{noches !== 1 ? "s" : ""}</span>
            <span className="text-gray-300">·</span>
            <span>{numPersonas} persona{numPersonas !== 1 ? "s" : ""}</span>
          </div>
          <Link
            href={`/p/${slug}`}
            className="text-sm text-gray-500 hover:text-gray-900 underline underline-offset-2"
          >
            Modificar
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {resultados.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Sin disponibilidad</h2>
            <p className="text-gray-500 text-sm mb-6">
              No hay habitaciones disponibles para las fechas seleccionadas.
            </p>
            <Link
              href={`/p/${slug}`}
              className="inline-block rounded-lg bg-gray-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Cambiar fechas
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm text-gray-500">
              {resultados.length} tipo{resultados.length !== 1 ? "s" : ""} disponible{resultados.length !== 1 ? "s" : ""}
            </p>

            {resultados.map((tipo) => {
              const precioPorNoche = noches > 0 ? Math.round(tipo.totalMxn / noches) : tipo.totalMxn;
              const pocasUnidades = tipo.habitacionesDisponibles <= 2;

              return (
                <div
                  key={tipo.tipoDeHabitacionId}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Foto */}
                  {tipo.fotos[0] ? (
                    <div className="relative h-56 bg-gray-100">
                      <img
                        src={tipo.fotos[0]}
                        alt={tipo.nombre}
                        className="w-full h-full object-cover"
                      />
                      {pocasUnidades && (
                        <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                          ¡Solo {tipo.habitacionesDisponibles} disponible{tipo.habitacionesDisponibles !== 1 ? "s" : ""}!
                        </span>
                      )}
                    </div>
                  ) : (
                    /* Placeholder cuando no hay foto */
                    <div className="relative h-40 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <svg className="w-12 h-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                      </svg>
                      {pocasUnidades && (
                        <span className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                          ¡Solo {tipo.habitacionesDisponibles} disponible{tipo.habitacionesDisponibles !== 1 ? "s" : ""}!
                        </span>
                      )}
                    </div>
                  )}

                  {/* Contenido */}
                  <div className="p-5">
                    {/* Encabezado */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{tipo.nombre}</h3>
                        <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                          </svg>
                          {tipo.capacidadMin === tipo.capacidadMax
                            ? `${tipo.capacidadMax} persona${tipo.capacidadMax !== 1 ? "s" : ""}`
                            : `${tipo.capacidadMin}–${tipo.capacidadMax} personas`}
                        </p>
                      </div>
                      {/* Precio */}
                      <div className="text-right shrink-0">
                        <p className="text-2xl font-bold text-gray-900">
                          ${precioPorNoche.toLocaleString("es-MX")}
                          <span className="text-sm font-normal text-gray-400"> /noche</span>
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Total: ${tipo.totalMxn.toLocaleString("es-MX")} MXN
                        </p>
                      </div>
                    </div>

                    {/* Descripción */}
                    {tipo.descripcion && (
                      <p className="text-sm text-gray-600 mb-4 leading-relaxed">{tipo.descripcion}</p>
                    )}

                    {/* Amenidades */}
                    {tipo.amenidades.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {tipo.amenidades.slice(0, 6).map((amenidad) => (
                          <span
                            key={amenidad}
                            className="inline-flex items-center gap-1 text-xs text-gray-600 bg-gray-100 rounded-full px-2.5 py-1"
                          >
                            {amenidad}
                          </span>
                        ))}
                        {tipo.amenidades.length > 6 && (
                          <span className="text-xs text-gray-400 px-1 py-1">
                            +{tipo.amenidades.length - 6} más
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer con desglose y CTA */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <p className="text-xs text-gray-400">
                        {noches} noche{noches !== 1 ? "s" : ""} · {numPersonas} persona{numPersonas !== 1 ? "s" : ""}
                      </p>
                      <Link
                        href={`/p/${slug}/reservar?tipoId=${tipo.tipoDeHabitacionId}&fechaIngreso=${sp.fechaIngreso}&fechaSalida=${sp.fechaSalida}&numPersonas=${numPersonas}`}
                        style={{ backgroundColor: colorPrimario }}
                        className="rounded-xl text-white px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
                      >
                        Reservar
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
