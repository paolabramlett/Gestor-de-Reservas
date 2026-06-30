import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { crearTipoAction } from "../actions";
import { TipoDeHabitacionForm } from "../TipoDeHabitacionForm";

export default async function NuevoTipoPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <a href="/panel/tipos" className="text-sm text-gray-500 hover:text-gray-700">← Tipos</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900">Nuevo tipo de habitación</h1>
      </div>

      <TipoDeHabitacionForm
        action={crearTipoAction}
        submitLabel="Crear tipo"
        cancelHref="/panel/tipos"
      />
    </div>
  );
}
