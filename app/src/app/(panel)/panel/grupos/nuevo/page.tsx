import { requireGestionReservas } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NuevoGrupoForm } from "./NuevoGrupoForm";
import Link from "next/link";

export default async function NuevoGrupoPage() {
  const usuario = await requireGestionReservas();

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    select: { id: true, nombre: true, capacidadMin: true, capacidadMax: true },
    orderBy: { nombre: "asc" },
  });

  const ahora = new Date();
  const hoy = ahora.toISOString().slice(0, 10);
  const mananaDate = new Date(ahora);
  mananaDate.setUTCDate(mananaDate.getUTCDate() + 1);
  const manana = mananaDate.toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-8 max-w-2xl">
      <div className="mb-6">
        <Link href="/panel/grupos" className="text-xs text-gray-400 hover:text-gray-600">← Reservas grupales</Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">Nueva reserva grupal</h1>
        <p className="text-sm text-gray-400 mt-0.5">Para familias o grupos con 2 o más habitaciones bajo un mismo código de reserva.</p>
      </div>
      <NuevoGrupoForm tipos={tipos} hoy={hoy} manana={manana} />
    </div>
  );
}
