"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

export type ReservaFila = {
  id: string;
  codigoReserva: string;
  origenOnline: boolean;
  grupoCodigo: string | null;
  huespedNombre: string;
  huespedEmail: string;
  tipoHabitacionNombre: string;
  habitacionNumero: string | null;
  fechaIngreso: string;
  fechaSalida: string;
  totalMxn: number;
  estado: string;
  pagoLabel: string;
  puedeEliminar: boolean;
};

type LoteResult = { ok: number; error: string[] };

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

const ESTADOS_CANCELABLES = ["PENDIENTE_PAGO", "CONFIRMADA", "EN_CURSO"];

const esHoy = (fechaIso: string) =>
  new Date(fechaIso).toDateString() === new Date().toDateString();

export function ReservasTableClient({
  filas,
  busqueda,
  cancelarEnLoteAction,
  eliminarEnLoteAction,
}: {
  filas: ReservaFila[];
  busqueda?: string;
  cancelarEnLoteAction: (formData: FormData) => Promise<LoteResult>;
  eliminarEnLoteAction: (formData: FormData) => Promise<LoteResult>;
}) {
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<"cancelar" | "eliminar" | null>(null);
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<LoteResult | null>(null);

  const filasSeleccionadas = filas.filter((f) => seleccion.has(f.id));
  const seleccionCancelable = filasSeleccionadas.filter((f) => ESTADOS_CANCELABLES.includes(f.estado));
  const seleccionEliminable = filasSeleccionadas.filter((f) => f.puedeEliminar);
  const seleccionNoEliminable = filasSeleccionadas.length - seleccionEliminable.length;

  function toggleUna(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    if (seleccion.size === filas.length) setSeleccion(new Set());
    else setSeleccion(new Set(filas.map((f) => f.id)));
  }

  function limpiarSeleccion() {
    setSeleccion(new Set());
    setResultado(null);
  }

  function confirmarCancelar(politica: "TOTAL" | "SIN_REEMBOLSO") {
    const ids = seleccionCancelable.map((f) => f.id);
    startTransition(async () => {
      const fd = new FormData();
      ids.forEach((id) => fd.append("reservaIds", id));
      fd.set("politicaReembolso", politica);
      const res = await cancelarEnLoteAction(fd);
      setResultado(res);
      setModal(null);
      setSeleccion(new Set());
    });
  }

  function confirmarEliminar() {
    const ids = seleccionEliminable.map((f) => f.id);
    startTransition(async () => {
      const fd = new FormData();
      ids.forEach((id) => fd.append("reservaIds", id));
      const res = await eliminarEnLoteAction(fd);
      setResultado(res);
      setModal(null);
      setSeleccion(new Set());
    });
  }

  return (
    <div>
      {resultado && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
            resultado.error.length > 0
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : "bg-green-50 border-green-200 text-green-800"
          }`}
        >
          <div>
            <p>{resultado.ok} reserva{resultado.ok !== 1 ? "s" : ""} procesada{resultado.ok !== 1 ? "s" : ""} correctamente.</p>
            {resultado.error.length > 0 && (
              <p className="mt-1">{resultado.error.length} no se pudieron procesar.</p>
            )}
          </div>
          <button onClick={() => setResultado(null)} className="text-xs underline shrink-0">
            Cerrar
          </button>
        </div>
      )}

      {seleccion.size > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 bg-gray-900 text-white rounded-lg px-4 py-2.5 text-sm">
          <span>{seleccion.size} seleccionada{seleccion.size !== 1 ? "s" : ""}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal("cancelar")}
              disabled={seleccionCancelable.length === 0 || pending}
              className="rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancelar seleccionadas
            </button>
            <button
              onClick={() => setModal("eliminar")}
              disabled={seleccionEliminable.length === 0 || pending}
              className="rounded-lg bg-red-500/90 hover:bg-red-500 px-3 py-1.5 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Eliminar seleccionadas
            </button>
            <button onClick={limpiarSeleccion} className="text-xs text-gray-300 hover:text-white px-2">
              Limpiar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={filas.length > 0 && seleccion.size === filas.length}
                    onChange={toggleTodas}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 min-w-[130px]">Código</th>
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
              {filas.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
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
              {filas.map((r) => (
                <tr key={r.id} className={`hover:bg-gray-50 ${seleccion.has(r.id) ? "bg-blue-50/50" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={seleccion.has(r.id)}
                      onChange={() => toggleUna(r.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/panel/reservas/${r.id}`} className="font-mono text-blue-600 hover:underline">
                      {r.codigoReserva}
                    </Link>
                    {r.origenOnline && !r.grupoCodigo && (
                      <span className="ml-1 text-xs text-gray-400">online</span>
                    )}
                    {r.grupoCodigo && (
                      <div className="mt-1">
                        <span className="font-mono text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 rounded px-1.5 py-0.5">
                          {r.grupoCodigo}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{r.huespedNombre}</div>
                    <div className="text-gray-400 text-xs">{r.huespedEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.tipoHabitacionNombre}</td>
                  <td className="px-4 py-3">
                    {r.habitacionNumero ? (
                      <span className="text-gray-700">{r.habitacionNumero}</span>
                    ) : (
                      <span className="text-amber-600 text-xs">Sin asignar</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 ${esHoy(r.fechaIngreso) ? "font-semibold text-blue-700" : "text-gray-700"}`}>
                    {new Date(r.fechaIngreso).toLocaleDateString("es-MX", { timeZone: "UTC" })}
                    {esHoy(r.fechaIngreso) && <span className="ml-1 text-xs">🔵 Hoy</span>}
                  </td>
                  <td className={`px-4 py-3 ${esHoy(r.fechaSalida) ? "font-semibold text-orange-600" : "text-gray-700"}`}>
                    {new Date(r.fechaSalida).toLocaleDateString("es-MX", { timeZone: "UTC" })}
                    {esHoy(r.fechaSalida) && <span className="ml-1 text-xs">🟠 Hoy</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">${r.totalMxn.toLocaleString("es-MX")}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[r.estado]}`}>
                      {ESTADO_LABEL[r.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={r.pagoLabel === "Stripe" ? "text-xs text-green-600" : "text-xs text-gray-600"}>
                      {r.pagoLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === "cancelar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Cancelar {seleccionCancelable.length} reserva{seleccionCancelable.length !== 1 ? "s" : ""}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Se cancelarán las reservas seleccionadas que aún pueden cancelarse
              {seleccionCancelable.length !== filasSeleccionadas.length &&
                ` (${filasSeleccionadas.length - seleccionCancelable.length} ya están completadas o canceladas y se omitirán)`}
              . ¿Aplicamos reembolso a los pagos con tarjeta encontrados?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => confirmarCancelar("TOTAL")}
                disabled={pending}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar y reembolsar pagos con tarjeta
              </button>
              <button
                onClick={() => confirmarCancelar("SIN_REEMBOLSO")}
                disabled={pending}
                className="w-full rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                Cancelar sin reembolso
              </button>
              <button
                onClick={() => setModal(null)}
                disabled={pending}
                className="w-full rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "eliminar" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              Eliminar {seleccionEliminable.length} reserva{seleccionEliminable.length !== 1 ? "s" : ""} permanentemente
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Esta acción no se puede deshacer. Solo se eliminarán las reservas sin ningún pago
              confirmado
              {seleccionNoEliminable > 0 &&
                ` (${seleccionNoEliminable} de tu selección tienen un pago registrado y no se tocarán — usa "Cancelar" para esas)`}
              .
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setModal(null)}
                disabled={pending}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Volver
              </button>
              <button
                onClick={confirmarEliminar}
                disabled={pending}
                className="flex-1 rounded-lg bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? "Eliminando…" : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
