import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BuscadorReservas } from "./BuscadorReservas";
import { Suspense } from "react";

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

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const { estado, q } = await searchParams;
  const busqueda = q?.trim();

  // When there's a search query, ignore the estado filter and search all states
  const whereEstado = busqueda
    ? {}
    : estado
    ? { estado: estado as any }
    : { estado: { in: ["PENDIENTE_PAGO", "CONFIRMADA", "EN_CURSO"] as any[] } };

  const whereBusqueda = busqueda
    ? {
        OR: [
          { codigoReserva: { contains: busqueda, mode: "insensitive" as const } },
          { nombreHuesped: { contains: busqueda, mode: "insensitive" as const } },
          {
            huesped: {
              OR: [
                { nombre: { contains: busqueda, mode: "insensitive" as const } },
                { email: { contains: busqueda, mode: "insensitive" as const } },
                { telefono: { contains: busqueda, mode: "insensitive" as const } },
              ],
            },
          },
        ],
      }
    : {};

  const reservas = await prisma.reserva.findMany({
    where: {
      propiedadId: usuario.propiedadId,
      ...whereEstado,
      ...whereBusqueda,
    },
    include: {
      huesped: true,
      tipoDeHabitacion: true,
      asignacion: { include: { habitacion: true } },
      pagoManual: true,
    },
    orderBy: { fechaIngreso: "asc" },
    take: 200,
  });

  const filtros = [
    { value: "", label: "Activas" },
    { value: "PENDIENTE_PAGO", label: "Pago pendiente" },
    { value: "CONFIRMADA", label: "Confirmadas" },
    { value: "EN_CURSO", label: "En curso" },
    { value: "COMPLETADA", label: "Completadas" },
    { value: "CANCELADA", label: "Canceladas" },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-gray-900">Reservas</h1>
        <Link
          href="/panel/reservas/nueva"
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 whitespace-nowrap"
        >
          + Nueva reserva
        </Link>
      </div>

      {/* Search bar */}
      <div className="mb-4">
        <Suspense>
          <BuscadorReservas />
        </Suspense>
      </div>

      {/* Filtros de estado — se ocultan cuando hay búsqueda activa */}
      {!busqueda && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
          {filtros.map((f) => (
            <Link
              key={f.value}
              href={f.value ? `/panel/reservas?estado=${f.value}` : "/panel/reservas"}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${
                (estado ?? "") === f.value
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      )}

      {busqueda && (
        <p className="text-sm text-gray-500 mb-4">
          {reservas.length === 0
            ? `Sin resultados para "${busqueda}"`
            : `${reservas.length} resultado${reservas.length !== 1 ? "s" : ""} para "${busqueda}"`}
        </p>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Huésped</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Habitación</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ingreso</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Salida</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Pago</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reservas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                    {busqueda ? (
                      <div className="space-y-1">
                        <p className="font-medium text-gray-500">Sin resultados</p>
                        <p className="text-xs">Intenta con el código, nombre o correo del huésped</p>
                      </div>
                    ) : (
                      "No hay reservas"
                    )}
                  </td>
                </tr>
              )}
              {reservas.map((r) => {
                const esHoy = (fecha: Date) =>
                  new Date(fecha).toDateString() === new Date().toDateString();
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/panel/reservas/${r.id}`} className="font-mono text-blue-600 hover:underline">
                        {r.codigoReserva}
                      </Link>
                      {r.origen === "ONLINE" && (
                        <span className="ml-1 text-xs text-gray-400">online</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{r.nombreHuesped || r.huesped.nombre}</div>
                      <div className="text-gray-400 text-xs">{r.huesped.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.tipoDeHabitacion.nombre}</td>
                    <td className="px-4 py-3">
                      {r.asignacion ? (
                        <span className="text-gray-700">{r.asignacion.habitacion.numero}</span>
                      ) : (
                        <span className="text-amber-600 text-xs">Sin asignar</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 ${esHoy(r.fechaIngreso) ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                      {new Date(r.fechaIngreso).toLocaleDateString("es-MX")}
                      {esHoy(r.fechaIngreso) && <span className="ml-1 text-xs">🔵 Hoy</span>}
                    </td>
                    <td className={`px-4 py-3 ${esHoy(r.fechaSalida) ? "font-semibold text-orange-600" : "text-gray-700"}`}>
                      {new Date(r.fechaSalida).toLocaleDateString("es-MX")}
                      {esHoy(r.fechaSalida) && <span className="ml-1 text-xs">🟠 Hoy</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      ${Number(r.totalMxn).toLocaleString("es-MX")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[r.estado]}`}>
                        {ESTADO_LABEL[r.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {r.pagoManual ? (
                        <span className="text-xs text-gray-600">{r.pagoManual.estadoDePago.replace("_", " ")}</span>
                      ) : (
                        <span className="text-xs text-green-600">Stripe</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
