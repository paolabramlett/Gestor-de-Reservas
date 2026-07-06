import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NuevaReservaForm } from "./NuevaReservaForm";

export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const { from } = await searchParams;

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, capacidadMin: true, capacidadMax: true },
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  return (
    <div className="p-8 max-w-2xl">
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
