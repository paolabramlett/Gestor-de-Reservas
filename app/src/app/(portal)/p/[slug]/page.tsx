import { getPropiedadBySlug } from "@/lib/auth";
import { notFound } from "next/navigation";
import FormularioBusqueda from "./buscar/FormularioBusqueda";

export default async function PortalHomePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const propiedad = await getPropiedadBySlug(slug);
  if (!propiedad) notFound();

  const colorPrimario = propiedad.colorPrimario ?? "#111827";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div
        className="relative px-4 py-20 text-center text-white"
        style={{ backgroundColor: colorPrimario }}
      >
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold mb-3 tracking-tight">{propiedad.nombre}</h1>
          {propiedad.descripcion && (
            <p className="text-base opacity-80 mb-0 leading-relaxed">{propiedad.descripcion}</p>
          )}
        </div>

        {/* Buscador flotante sobre el hero */}
        <div className="relative max-w-3xl mx-auto mt-10">
          <div className="bg-white rounded-2xl shadow-xl p-5 text-left">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Consulta disponibilidad</p>
            <FormularioBusqueda slug={slug} colorPrimario={colorPrimario} />
          </div>
        </div>
      </div>

      {/* Espacio para que el contenido no quede detrás del hero */}
      <div className="pb-12" />
    </div>
  );
}
