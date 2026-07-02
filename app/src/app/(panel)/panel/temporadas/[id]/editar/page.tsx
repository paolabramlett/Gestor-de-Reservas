import { getCurrentUsuario } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarTemporadaAction } from "../../actions";
import { TemporadaForm } from "../../TemporadaForm";

export default async function EditarTemporadaPage({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const { id } = await params;

  const temporada = await prisma.temporada.findFirst({
    where: { id, propiedadId: usuario.propiedadId },
  });
  if (!temporada) notFound();

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    orderBy: { nombre: "asc" },
  });

  const fmt = (d: Date) => new Date(d).toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-8 max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Editar temporada</h1>
      <TemporadaForm
        action={actualizarTemporadaAction}
        tipos={tipos}
        defaults={{
          id: temporada.id,
          nombre: temporada.nombre,
          tipoDeHabitacionId: temporada.tipoDeHabitacionId,
          fechaInicio: fmt(temporada.fechaInicio),
          fechaFin: fmt(temporada.fechaFin),
          precio: Number(temporada.precio),
          modalidad: temporada.modalidad,
          suplementoPorPersona: temporada.suplementoPorPersona ? Number(temporada.suplementoPorPersona) : null,
        }}
      />
    </div>
  );
}
