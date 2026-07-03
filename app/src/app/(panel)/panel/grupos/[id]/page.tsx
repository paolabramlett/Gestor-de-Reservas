import { getCurrentUsuario } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AgregarHabitacionPanel } from "./AgregarHabitacionPanel";
import { actualizarGrupoAction } from "../actions";
import { BotonDesvincular, BotonEliminarGrupo } from "./BotonesGrupo";
import { SolicitarPagoGrupo } from "./SolicitarPagoGrupo";

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE_PAGO: "Pago pendiente",
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-Show",
};

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE_PAGO: "bg-amber-100 text-amber-800",
  CONFIRMADA: "bg-blue-100 text-blue-800",
  EN_CURSO: "bg-green-100 text-green-800",
  COMPLETADA: "bg-gray-100 text-gray-600",
  CANCELADA: "bg-red-100 text-red-700",
  NO_SHOW: "bg-orange-100 text-orange-800",
};

export default async function GrupoDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const { id } = await params;
  const sp = await searchParams;

  const grupo = await prisma.grupoReserva.findFirst({
    where: { id, propiedadId: usuario.propiedadId },
    include: {
      reservas: {
        include: {
          huesped: true,
          tipoDeHabitacion: true,
          asignacion: { include: { habitacion: true } },
          pagoManual: true,
        },
        orderBy: { fechaIngreso: "asc" },
      },
    },
  });

  if (!grupo) notFound();

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    orderBy: { nombre: "asc" },
  });

  const totalGeneral = grupo.reservas.reduce((s, r) => s + Number(r.totalMxn), 0);
  const totalPagado = Number(grupo.totalPagado);
  const restante = totalGeneral - totalPagado;
  const reservasActivas = grupo.reservas.filter((r) => !["CANCELADA", "NO_SHOW"].includes(r.estado));

  // Use first active reservation's guest as default contact
  const contacto = reservasActivas[0]?.huesped;
  const fechaMin = reservasActivas.length
    ? reservasActivas.reduce((min, r) => r.fechaIngreso < min ? r.fechaIngreso : min, reservasActivas[0].fechaIngreso)
    : null;
  const fechaMax = reservasActivas.length
    ? reservasActivas.reduce((max, r) => r.fechaSalida > max ? r.fechaSalida : max, reservasActivas[0].fechaSalida)
    : null;

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      {sp.success && (
        <div className="mb-5 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
          {sp.success}
        </div>
      )}
      {sp.error && (
        <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {sp.error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <Link href="/panel/grupos" className="text-xs text-gray-400 hover:text-gray-600 mb-1 block">← Grupos</Link>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-400">{grupo.codigoGrupo}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{grupo.nombre}</h1>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-gray-900">${totalGeneral.toLocaleString("es-MX")}</p>
          <p className="text-xs text-gray-400">MXN total · {reservasActivas.length} hab. activas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: reservations */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Habitaciones</h2>

          {grupo.reservas.length === 0 && (
            <p className="text-sm text-gray-400 py-4">Sin habitaciones todavía. Agrega la primera abajo.</p>
          )}

          {grupo.reservas.map((r) => {
            const noches = Math.round(
              (r.fechaSalida.getTime() - r.fechaIngreso.getTime()) / 86400000
            );
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/panel/reservas/${r.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {r.codigoReserva}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[r.estado]}`}>
                        {ESTADO_LABEL[r.estado]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 mt-1">{r.tipoDeHabitacion.nombre}</p>
                    {r.asignacion && (
                      <p className="text-xs text-gray-400">Hab. {r.asignacion.habitacion.numero}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">${Number(r.totalMxn).toLocaleString("es-MX")}</p>
                    <p className="text-xs text-gray-400">{noches} noche{noches !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs text-gray-600 mb-3">
                  <div>
                    <span className="text-gray-400 block">Huésped</span>
                    <span className="font-medium">{r.nombreHuesped || r.huesped.nombre}</span>
                    {r.huesped.telefono && <span className="text-gray-400 block">{r.huesped.telefono}</span>}
                  </div>
                  <div>
                    <span className="text-gray-400 block">Fechas</span>
                    <span className="font-medium">
                      {new Date(r.fechaIngreso).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })}
                      {" → "}
                      {new Date(r.fechaSalida).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Personas</span>
                    <span className="font-medium">{r.numPersonas}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Pago</span>
                    <span className="font-medium">
                      {r.pagoManual ? r.pagoManual.estadoDePago.replace(/_/g, " ") : "Stripe"}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <Link
                    href={`/panel/reservas/${r.id}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Ver reserva completa →
                  </Link>
                  <div className="ml-auto">
                    <BotonDesvincular reservaId={r.id} grupoId={grupo.id} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Add room */}
          <AgregarHabitacionPanel
            grupoId={grupo.id}
            tipos={tipos}
            fechaIngresoGrupo={fechaMin ? new Date(fechaMin).toISOString().slice(0, 10) : undefined}
            fechaSalidaGrupo={fechaMax ? new Date(fechaMax).toISOString().slice(0, 10) : undefined}
            emailContacto={contacto?.email}
            nombreContacto={contacto ? (reservasActivas[0]?.nombreHuesped || contacto.nombre) : undefined}
          />
        </div>

        {/* Right: group info + summary */}
        <div className="space-y-4">
          {/* Summary */}
          {fechaMin && fechaMax && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resumen</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Habitaciones activas</span>
                  <span className="font-medium">{reservasActivas.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total personas</span>
                  <span className="font-medium">{reservasActivas.reduce((s, r) => s + r.numPersonas, 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Check-in</span>
                  <span className="font-medium">
                    {new Date(fechaMin).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Check-out</span>
                  <span className="font-medium">
                    {new Date(fechaMax).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-medium">Total grupo</span>
                    <span className="font-bold text-gray-900">${totalGeneral.toLocaleString("es-MX")} MXN</span>
                  </div>
                  {totalPagado > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-green-700">Pagado</span>
                        <span className="font-semibold text-green-700">${totalPagado.toLocaleString("es-MX")} MXN</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className={restante <= 0 ? "text-gray-400" : "text-amber-700"}>
                          {restante <= 0 ? "Saldado ✓" : "Restante"}
                        </span>
                        <span className={`font-semibold ${restante <= 0 ? "text-gray-400" : "text-amber-700"}`}>
                          {restante <= 0 ? "—" : `$${restante.toLocaleString("es-MX")} MXN`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payment request */}
          {reservasActivas.length > 0 && contacto && restante > 0 && (
            <SolicitarPagoGrupo
              grupoId={grupo.id}
              totalGrupo={totalGeneral}
              totalPagado={totalPagado}
              restante={restante}
              emailContacto={contacto.email}
            />
          )}
          {restante <= 0 && totalPagado > 0 && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 text-center font-medium">
              Grupo saldado completamente ✓
            </div>
          )}

          {/* Edit group */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Datos del grupo</h3>
            <form action={actualizarGrupoAction} className="space-y-3">
              <input type="hidden" name="grupoId" value={grupo.id} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input
                  name="nombre"
                  required
                  defaultValue={grupo.nombre}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Notas</label>
                <textarea
                  name="notas"
                  rows={3}
                  defaultValue={grupo.notas ?? ""}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <button type="submit" className="w-full rounded-lg bg-gray-100 text-gray-700 py-1.5 text-sm font-medium hover:bg-gray-200">
                Guardar cambios
              </button>
            </form>
          </div>

          {/* Delete group */}
          {grupo.reservas.length === 0 && (
            <BotonEliminarGrupo grupoId={grupo.id} />
          )}
        </div>
      </div>
    </div>
  );
}
