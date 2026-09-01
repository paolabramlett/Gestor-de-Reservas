import { requireGestionReservas } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { BuscadorReservas } from "./BuscadorReservas";
import { Suspense } from "react";
import { tieneEliminacionSegura } from "@/lib/negocio/cicloDeVida";
import { cancelarReservasEnLoteAction, eliminarReservasEnLoteAction } from "./cicloDeVidaActions";
import { ReservasTableClient, type ReservaFila } from "./ReservasTableClient";
import { EstadoReserva, Prisma } from "@prisma/client";
import { obtenerLedgerReserva } from "@/lib/negocio/pagosExternos.server";
import { aCentavos } from "@/lib/negocio/resumenFinanciero";

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const usuario = await requireGestionReservas();

  const { estado, q } = await searchParams;
  const busqueda = q?.trim();

  // When there's a search query, ignore the estado filter and search all states
  const whereEstado: Prisma.ReservaWhereInput = busqueda
    ? {}
    : estado
    ? { estado: estado as EstadoReserva }
    : { estado: { in: [EstadoReserva.PENDIENTE_PAGO, EstadoReserva.CONFIRMADA, EstadoReserva.EN_CURSO] } };

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
          // Buscar por código de grupo (multi-habitación)
          {
            grupo: {
              codigoGrupo: { contains: busqueda, mode: "insensitive" as const },
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
      grupo: { select: { codigoGrupo: true, totalPagado: true } },
    },
    orderBy: { fechaIngreso: "asc" },
    take: 200,
  });

  const actorLedger = {
    usuarioPropiedadId: usuario.id,
    propiedadId: usuario.propiedadId,
    rol: usuario.rol,
  };
  const ledgers = await Promise.all(
    reservas.map((reserva) => obtenerLedgerReserva(actorLedger, reserva.id))
  );

  const filas: ReservaFila[] = reservas.map((r, indice) => ({
    id: r.id,
    codigoReserva: r.codigoReserva,
    origenOnline: r.origen === "ONLINE",
    grupoCodigo: r.grupo?.codigoGrupo ?? null,
    huespedNombre: r.nombreHuesped || r.huesped.nombre,
    huespedEmail: r.huesped.email,
    tipoHabitacionNombre: r.tipoDeHabitacion.nombre,
    habitacionNumero: r.asignacion?.habitacion.numero ?? null,
    fechaIngreso: r.fechaIngreso.toISOString(),
    fechaSalida: r.fechaSalida.toISOString(),
    totalMxn: Number(r.totalMxn),
    estado: r.estado,
    pagoLabel: ledgers[indice].resumen.estado.replaceAll("_", " "),
    puedeEliminar: tieneEliminacionSegura({
      tienePagosStripe: ledgers[indice].pagosStripe.length > 0,
      tienePagosExternos: ledgers[indice].pagosExternos.length > 0,
      grupoPagadoCentavos: r.grupo ? aCentavos(Number(r.grupo.totalPagado)) : 0,
    }),
  }));

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
          className="roomly-button-primary px-4 py-2 text-sm whitespace-nowrap"
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
                  : "bg-white border border-slate-300 text-gray-600 hover:bg-slate-50"
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

      <ReservasTableClient
        filas={filas}
        busqueda={busqueda}
        cancelarEnLoteAction={cancelarReservasEnLoteAction}
        eliminarEnLoteAction={eliminarReservasEnLoteAction}
      />
    </div>
  );
}
