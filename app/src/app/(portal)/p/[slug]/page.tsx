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

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{propiedad.nombre}</h1>
      {propiedad.descripcion && (
        <p className="text-gray-600 mb-8">{propiedad.descripcion}</p>
      )}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Consulta disponibilidad
        </h2>
        <FormularioBusqueda slug={slug} />
      </div>
    </div>
  );
}
