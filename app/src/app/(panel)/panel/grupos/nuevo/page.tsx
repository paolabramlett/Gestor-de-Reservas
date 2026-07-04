import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NuevoGrupoForm } from "./NuevoGrupoForm";

export default async function NuevoGrupoPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    select: { id: true, nombre: true, capacidadMin: true, capacidadMax: true },
    orderBy: { nombre: "asc" },
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <a href="/panel/grupos" className="text-xs text-gray-400 hover:text-gray-600">← Reservas grupales</a>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Nueva reserva grupal</h1>
        <p className="text-sm text-gray-400 mt-0.5">Para familias o grupos con 2 o más habitaciones bajo un mismo código de reserva.</p>
      </div>
      <NuevoGrupoForm tipos={tipos} hoy={hoy} manana={manana} />
    </div>
  );
}
