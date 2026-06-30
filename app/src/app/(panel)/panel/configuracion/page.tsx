import { requireAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ConfiguracionForm from "./ConfiguracionForm";

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

      <ConfiguracionForm
        nombre={propiedad.nombre}
        descripcion={propiedad.descripcion ?? ""}
        telefono={propiedad.telefono ?? ""}
        email={propiedad.email ?? ""}
        direccion={propiedad.direccion ?? ""}
        colorPrimario={propiedad.colorPrimario ?? "#111827"}
        slug={propiedad.slug}
        logoUrl={propiedad.logoUrl ?? ""}
      />
    </div>
  );
}
