import { requireGestionReservas } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NuevaReservaForm } from "./NuevaReservaForm";

export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const usuario = await requireGestionReservas();

  const { from } = await searchParams;

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, capacidadMin: true, capacidadMax: true },
  });

  const ahora = new Date();
  const hoy = ahora.toISOString().slice(0, 10);
  const mananaDate = new Date(ahora);
  mananaDate.setUTCDate(mananaDate.getUTCDate() + 1);
  const manana = mananaDate.toISOString().slice(0, 10);

  return (
    <div className="w-full min-w-0 p-4 md:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <a
          href={from === "calendario" ? "/panel/calendario" : "/panel/reservas"}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {from === "calendario" ? "Calendario" : "Reservas"}
        </a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">Nueva reserva</h1>
      </div>

      <NuevaReservaForm
        tipos={tipos}
        hoy={hoy}
        manana={manana}
        from={from}
        esPro={usuario.propiedad.planActivo === "PRO" && usuario.propiedad.stripeConnectHabilitado}
      />
    </div>
  );
}
