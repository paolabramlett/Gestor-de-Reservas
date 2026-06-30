import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { crearReservaManualAction } from "../actions";
import DisponibilidadCheck from "./DisponibilidadCheck";
import { DatePicker } from "@/components/DatePicker";

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

      <form action={crearReservaManualAction} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
        <input type="hidden" name="from" value={from ?? ""} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de habitación</label>
          <select name="tipoDeHabitacionId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">Seleccionar...</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} (cap. {t.capacidadMin}–{t.capacidadMax})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
            <DatePicker name="fechaIngreso" defaultValue={hoy} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de salida</label>
            <DatePicker name="fechaSalida" defaultValue={manana} required />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Número de personas</label>
          <input type="number" name="numPersonas" defaultValue={2} min={1} max={10} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        {/* Aviso de disponibilidad (task 8.3) */}
        <DisponibilidadCheck />

        <hr className="border-gray-200" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del huésped</label>
          <input type="text" name="nombre" required placeholder="Nombre completo" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" name="email" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input type="tel" name="telefono" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <hr className="border-gray-200" />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Estado de pago</label>
          <select name="estadoDePago" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="PENDIENTE">Pendiente</option>
            <option value="ANTICIPO_PAGADO">Anticipo pagado</option>
            <option value="PAGADO_COMPLETO">Pagado completo</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
          <textarea name="notas" rows={3} placeholder="Notas opcionales..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700">
            Crear reserva
          </button>
          <a
            href={from === "calendario" ? "/panel/calendario" : "/panel/reservas"}
            className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </a>
        </div>
      </form>
    </div>
  );
}
