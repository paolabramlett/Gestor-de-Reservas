import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { crearTemporadaAction } from "../actions";
import { TemporadaForm } from "../TemporadaForm";

export default async function NuevaTemporadaPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    orderBy: { nombre: "asc" },
  });

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="p-4 md:p-8 max-w-xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Nueva temporada</h1>
      <TemporadaForm
        action={crearTemporadaAction}
        tipos={tipos}
        defaults={{ fechaInicio: hoy, fechaFin: hoy, precio: 0 }}
      />
    </div>
  );
}
