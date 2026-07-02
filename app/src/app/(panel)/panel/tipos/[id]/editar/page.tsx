import { getCurrentUsuario } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarTipoAction } from "../../actions";
import { TipoDeHabitacionForm } from "../../TipoDeHabitacionForm";
import { IcalSection } from "./IcalSection";

export default async function EditarTipoPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const { id } = await params;

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id, propiedadId: usuario.propiedadId },
    include: { icalFeeds: { orderBy: { creadoEn: "asc" } } },
  });
  if (!tipo) notFound();

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const exportUrl = `${baseUrl}/api/ical/${tipo.icalToken}`;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/panel/tipos" className="text-sm text-gray-500 hover:text-gray-700">← Tipos</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">Editar tipo: {tipo.nombre}</h1>
      </div>

      <TipoDeHabitacionForm
        action={actualizarTipoAction}
        tipo={{
          id: tipo.id,
          nombre: tipo.nombre,
          descripcion: tipo.descripcion,
          capacidadMin: tipo.capacidadMin,
          capacidadMax: tipo.capacidadMax,
          tarifaBasePrice: Number(tipo.tarifaBasePrice),
          tarifaBaseModalidad: tipo.tarifaBaseModalidad,
          suplementoPorPersona: tipo.suplementoPorPersona ? Number(tipo.suplementoPorPersona) : null,
          activo: tipo.activo,
          fotos: tipo.fotos,
          amenidades: tipo.amenidades,
        }}
        submitLabel="Guardar cambios"
        cancelHref="/panel/tipos"
      />

      {tipo.icalToken && (
        <IcalSection
          tipoDeHabitacionId={tipo.id}
          exportUrl={exportUrl}
          feeds={tipo.icalFeeds.map((f) => ({
            id: f.id,
            nombre: f.nombre,
            url: f.url,
            lastSyncedAt: f.lastSyncedAt?.toISOString() ?? null,
          }))}
        />
      )}
    </div>
  );
}
