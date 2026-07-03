import { getCurrentUsuario } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  asignarHabitacionAction,
  actualizarPagoYNotasAction,
  actualizarDatosReservaAction,
  solicitarPagoAction,
} from "../actions";
import { DatePicker } from "@/components/DatePicker";
import {
  checkInAction,
  checkOutAction,
  noShowAction,
  cancelarReservaAction,
} from "../cicloDeVidaActions";
import { PropuestaCambioPanel } from "../PropuestaCambioPanel";
import { BotonesEstadoReserva, CancelarDialogClient } from "../BotonesEstadoReserva";
import { SolicitarPagoButton } from "../SolicitarPagoButton";

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

export default async function ReservaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const { id } = await params;
  const { error } = await searchParams;

  const reserva = await prisma.reserva.findFirst({
    where: { id, propiedadId: usuario.propiedadId },
    include: {
      huesped: true,
      tipoDeHabitacion: true,
      asignacion: { include: { habitacion: true } },
      pagoManual: true,
      grupo: true,
    },
  });
  if (!reserva) notFound();

  const [habitacionesDelTipo, tiposDeHabitacion, solicitudPendiente, ultimaSolicitudResuelta] = await Promise.all([
    prisma.habitacion.findMany({
      where: {
        propiedadId: usuario.propiedadId,
        tipoDeHabitacionId: reserva.tipoDeHabitacionId,
        activa: true,
      },
      orderBy: { numero: "asc" },
    }),
    prisma.tipoDeHabitacion.findMany({
      where: { propiedadId: usuario.propiedadId, activo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.solicitudCambio.findFirst({
      where: { reservaId: id, estado: "PENDIENTE" },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.solicitudCambio.findFirst({
      where: { reservaId: id, estado: { in: ["RECHAZADA", "CANCELADA", "EXPIRADA"] } },
      orderBy: { creadoEn: "desc" },
    }),
  ]);

  const esPagoManual = reserva.origen === "MANUAL";
  const esOnline = reserva.origen === "ONLINE";
  const estado = reserva.estado;

  const esEditable = estado === "CONFIRMADA" || estado === "EN_CURSO";
  // BUG 7: la sección de pago también se muestra en PENDIENTE_PAGO para poder reenviar el link
  const esPagoNotasVisible = esPagoManual && (esEditable || estado === "PENDIENTE_PAGO");

  return (
    <div className="p-8 max-w-3xl">
      {/* Encabezado */}
      <div className="flex items-center gap-3 mb-2">
        <a href="/panel/reservas" className="text-sm text-gray-500 hover:text-gray-700">← Reservas</a>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-semibold text-gray-900 font-mono">{reserva.codigoReserva}</h1>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[estado]}`}>
          {ESTADO_LABEL[estado]}
        </span>
      </div>

      {/* Banner grupo */}
      {reserva.grupo && (
        <div className="mb-4 rounded-xl bg-indigo-50 border border-indigo-200 px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <div>
              <span className="text-xs text-indigo-500 font-mono">{reserva.grupo.codigoGrupo}</span>
              <p className="text-sm font-semibold text-indigo-900">{reserva.grupo.nombre}</p>
            </div>
          </div>
          <a href={`/panel/grupos/${reserva.grupo.id}`} className="text-xs text-indigo-600 hover:underline whitespace-nowrap">
            Ver grupo →
          </a>
        </div>
      )}

      {/* Banner PENDIENTE_PAGO */}
      {estado === "PENDIENTE_PAGO" && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3 items-start">
          <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Esperando pago del huésped</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Se envió un link de pago al huésped. La reserva se confirmará automáticamente cuando complete el pago.
              {reserva.linkExpiraEn && (
                <> El link expira el <strong>{new Date(reserva.linkExpiraEn).toLocaleDateString("es-MX", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</strong>.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Error de operación */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Acciones de ciclo de vida (task 9.1–9.5) */}
      {esEditable && (
        <div className="flex flex-wrap gap-2 mb-6">
          <BotonesEstadoReserva
            reservaId={reserva.id}
            estado={estado}
            checkInAction={checkInAction}
            checkOutAction={checkOutAction}
            noShowAction={noShowAction}
            saldoPendiente={
              reserva.pagoManual?.estadoDePago === "PENDIENTE"
                ? Number(reserva.totalMxn)
                : reserva.pagoManual?.estadoDePago === "ANTICIPO_PAGADO" && reserva.pagoManual.montoAnticipo
                ? Number(reserva.totalMxn) - Number(reserva.pagoManual.montoAnticipo)
                : null
            }
          />

          {/* Cancelar */}
          <CancelarDialog reservaId={reserva.id} esOnline={esOnline} totalMxn={Number(reserva.totalMxn)} />
        </div>
      )}

      {/* Proponer cambio de fechas — solo reservas online confirmadas */}
      {estado === "CONFIRMADA" && esOnline && (
        <div className="mb-6">
          <PropuestaCambioPanel
            reservaId={reserva.id}
            fechaIngresoActual={reserva.fechaIngreso.toISOString().split("T")[0]}
            fechaSalidaActual={reserva.fechaSalida.toISOString().split("T")[0]}
            numPersonas={reserva.numPersonas}
            tipoDeHabitacionId={reserva.tipoDeHabitacionId}
            totalActual={Number(reserva.totalMxn)}
            solicitudPendiente={solicitudPendiente ? {
              id: solicitudPendiente.id,
              token: solicitudPendiente.token,
              fechaIngresoNueva: solicitudPendiente.fechaIngresoNueva.toISOString().split("T")[0],
              fechaSalidaNueva: solicitudPendiente.fechaSalidaNueva.toISOString().split("T")[0],
              totalActual: Number(solicitudPendiente.totalActual),
              totalNuevo: Number(solicitudPendiente.totalNuevo),
              diferencia: Number(solicitudPendiente.diferencia),
              expiresAt: solicitudPendiente.expiresAt.toISOString(),
            } : null}
            ultimaSolicitudResuelta={ultimaSolicitudResuelta ? {
              estado: ultimaSolicitudResuelta.estado,
              fechaIngresoNueva: ultimaSolicitudResuelta.fechaIngresoNueva.toISOString().split("T")[0],
              fechaSalidaNueva: ultimaSolicitudResuelta.fechaSalidaNueva.toISOString().split("T")[0],
              creadoEn: ultimaSolicitudResuelta.creadoEn.toISOString(),
            } : null}
          />
        </div>
      )}

      {/* Datos editables de la reserva */}
      {esEditable ? (
        <form action={actualizarDatosReservaAction} className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <input type="hidden" name="reservaId" value={reserva.id} />
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Datos de la reserva</h2>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm mb-4">
            {/* Tipo de habitación */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Tipo de habitación</label>
              <select
                name="tipoDeHabitacionId"
                defaultValue={reserva.tipoDeHabitacionId}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {tiposDeHabitacion.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
              {reserva.asignacion && (
                <p className="text-xs text-amber-600 mt-1">
                  Si cambias el tipo, la habitación asignada se liberará y deberás reasignar.
                </p>
              )}
            </div>

            {/* Origen (solo lectura) */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Origen</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                {esOnline ? "Online (Stripe)" : "Manual"}
              </div>
            </div>

            {/* Fechas — solo lectura para reservas online (usar "Proponer cambio") */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha de ingreso</label>
              {esOnline ? (
                <>
                  <input type="hidden" name="fechaIngreso" value={reserva.fechaIngreso.toISOString().slice(0, 10)} />
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm">
                    {new Date(reserva.fechaIngreso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                  </div>
                </>
              ) : (
                <DatePicker name="fechaIngreso" defaultValue={reserva.fechaIngreso.toISOString().slice(0, 10)} required />
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Fecha de salida</label>
              {esOnline ? (
                <>
                  <input type="hidden" name="fechaSalida" value={reserva.fechaSalida.toISOString().slice(0, 10)} />
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm">
                    {new Date(reserva.fechaSalida).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
                  </div>
                </>
              ) : (
                <DatePicker name="fechaSalida" defaultValue={reserva.fechaSalida.toISOString().slice(0, 10)} required />
              )}
            </div>

            {/* Personas */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Número de personas</label>
              <input
                type="number"
                name="numPersonas"
                defaultValue={reserva.numPersonas}
                min={reserva.tipoDeHabitacion.capacidadMin}
                max={reserva.tipoDeHabitacion.capacidadMax}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Total — comportamiento según tipoEspecial */}
            <div>
              {reserva.tipoEspecial === "CORTESIA" ? (
                <>
                  <label className="block text-xs text-gray-500 mb-1">Total (MXN)</label>
                  <div className="px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-purple-700 text-sm font-medium">
                    $0 — Cortesía
                  </div>
                </>
              ) : reserva.tipoEspecial === "PRECIO_ACORDADO" || reserva.tipoEspecial === "PROMOCION" ? (
                <>
                  <label className="block text-xs text-gray-500 mb-1">
                    {reserva.tipoEspecial === "PROMOCION" ? "Precio de promoción (MXN)" : "Precio acordado (MXN)"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input
                      type="number"
                      name="totalOverride"
                      defaultValue={Number(reserva.totalMxn)}
                      min={0}
                      step="0.01"
                      required
                      className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Este precio no se recalcula automáticamente.</p>
                </>
              ) : (
                <>
                  <label className="block text-xs text-gray-500 mb-1">Total actual (MXN)</label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-semibold text-gray-900">
                    ${Number(reserva.totalMxn).toLocaleString("es-MX")}
                    <span className="ml-1 text-xs font-normal text-gray-400">se recalcula al guardar</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Huésped */}
          <div className="border-t border-gray-100 pt-4 mb-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Huésped</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-gray-500 mb-1">Nombre completo</label>
                <input
                  type="text"
                  name="nombre"
                  defaultValue={reserva.huesped.nombre}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  defaultValue={reserva.huesped.email}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                <input
                  type="tel"
                  name="telefono"
                  defaultValue={reserva.huesped.telefono ?? ""}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700"
          >
            Guardar cambios
          </button>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Detalles (solo lectura) */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Reserva</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Tipo</dt>
                <dd className="text-gray-900">{reserva.tipoDeHabitacion.nombre}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Ingreso</dt>
                <dd className="text-gray-900">{new Date(reserva.fechaIngreso).toLocaleDateString("es-MX")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Salida</dt>
                <dd className="text-gray-900">{new Date(reserva.fechaSalida).toLocaleDateString("es-MX")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Personas</dt>
                <dd className="text-gray-900">{reserva.numPersonas}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total</dt>
                <dd className="font-semibold text-gray-900">${Number(reserva.totalMxn).toLocaleString("es-MX")} MXN</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Origen</dt>
                <dd className="text-gray-900">{esOnline ? "Online (Stripe)" : "Manual"}</dd>
              </div>
            </dl>
          </div>

          {/* Huésped (solo lectura) */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Huésped</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-gray-500">Nombre</dt>
                <dd className="text-gray-900 font-medium">{reserva.nombreHuesped || reserva.huesped.nombre}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-900">{reserva.huesped.email}</dd>
              </div>
              {reserva.huesped.telefono && (
                <div>
                  <dt className="text-gray-500">Teléfono</dt>
                  <dd className="text-gray-900">{reserva.huesped.telefono}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}

      {/* Asignación de habitación */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Habitación asignada</h2>
        {reserva.asignacion ? (
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-700">
              Hab. <span className="font-medium">{reserva.asignacion.habitacion.numero}</span>
            </p>
            <a
              href={`/panel/calendario?mes=${reserva.fechaIngreso.getMonth() + 1}&año=${reserva.fechaIngreso.getFullYear()}`}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              Ver en calendario
            </a>
          </div>
        ) : (
          <p className="text-sm text-amber-600 mb-3">Sin habitación asignada — necesaria para hacer check-in</p>
        )}
        {esEditable && (
          <form action={asignarHabitacionAction} className="flex gap-3 items-end">
            <input type="hidden" name="reservaId" value={reserva.id} />
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Asignar habitación</label>
              <select name="habitacionId" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" required>
                <option value="">Seleccionar...</option>
                {habitacionesDelTipo.map((h) => (
                  <option key={h.id} value={h.id} selected={reserva.asignacion?.habitacionId === h.id}>
                    {h.numero}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
              Asignar
            </button>
          </form>
        )}
      </div>

      {/* Pago y notas — reservas manuales editables o esperando pago */}
      {esPagoNotasVisible && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Pago y notas</h2>
            {reserva.tipoEspecial !== "CORTESIA" && reserva.pagoManual?.estadoDePago !== "PAGADO_COMPLETO" && (
              <SolicitarPagoButton
                reservaId={reserva.id}
                totalMxn={Number(reserva.totalMxn)}
                emailHuesped={reserva.huesped.email}
                yaTieneLinkActivo={
                  reserva.estado === "PENDIENTE_PAGO" &&
                  !!reserva.linkExpiraEn &&
                  new Date(reserva.linkExpiraEn) > new Date()
                }
                solicitarPagoAction={solicitarPagoAction}
              />
            )}
          </div>

          {/* Resumen de saldo */}
          {reserva.pagoManual?.estadoDePago === "ANTICIPO_PAGADO" && reserva.pagoManual.montoAnticipo && (
            <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm">
              <div className="flex justify-between text-gray-700">
                <span>Total</span>
                <span className="font-medium">${Number(reserva.totalMxn).toLocaleString("es-MX")} MXN</span>
              </div>
              <div className="flex justify-between text-green-700 mt-1">
                <span>Anticipo pagado</span>
                <span className="font-medium">${Number(reserva.pagoManual.montoAnticipo).toLocaleString("es-MX")} MXN</span>
              </div>
              <div className="flex justify-between text-amber-800 font-semibold mt-1 pt-1 border-t border-amber-200">
                <span>Falta por pagar</span>
                <span>${(Number(reserva.totalMxn) - Number(reserva.pagoManual.montoAnticipo)).toLocaleString("es-MX")} MXN</span>
              </div>
            </div>
          )}

          {/* BUG 7: en PENDIENTE_PAGO solo mostrar el resumen; el formulario queda bloqueado hasta que el huesped pague */}
          {estado === "PENDIENTE_PAGO" ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              El formulario de pago está bloqueado mientras el huésped tiene un link activo. Usa el botón de arriba para reenviar o espera a que complete el pago.
            </p>
          ) : (
          <form action={actualizarPagoYNotasAction} className="space-y-4">
            <input type="hidden" name="reservaId" value={reserva.id} />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Estado de pago</label>
              <select name="estadoDePago" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="PENDIENTE" selected={reserva.pagoManual?.estadoDePago === "PENDIENTE"}>Pendiente</option>
                <option value="ANTICIPO_PAGADO" selected={reserva.pagoManual?.estadoDePago === "ANTICIPO_PAGADO"}>Anticipo pagado</option>
                <option value="PAGADO_COMPLETO" selected={reserva.pagoManual?.estadoDePago === "PAGADO_COMPLETO"}>Pagado completo</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Monto de anticipo (MXN)
                <span className="ml-1 text-gray-400 font-normal">— solo si aplica</span>
              </label>
              <input
                type="number"
                name="montoAnticipo"
                min={0}
                max={Number(reserva.totalMxn)}
                step="0.01"
                defaultValue={reserva.pagoManual?.montoAnticipo ? Number(reserva.pagoManual.montoAnticipo) : ""}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notas internas</label>
              <textarea name="notas" rows={3} defaultValue={reserva.pagoManual?.notas ?? ""} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <button type="submit" className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
              Guardar cambios
            </button>
          </form>
          )}
        </div>
      )}

      {/* Info de pago en estados terminales */}
      {esPagoManual && !esEditable && reserva.pagoManual && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Pago</h2>
          <p className="text-sm text-gray-700">{reserva.pagoManual.estadoDePago.replace(/_/g, " ").toLowerCase()}</p>
          {reserva.pagoManual.estadoDePago === "ANTICIPO_PAGADO" && reserva.pagoManual.montoAnticipo && (
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Anticipo pagado</span>
                <span>${Number(reserva.pagoManual.montoAnticipo).toLocaleString("es-MX")} MXN</span>
              </div>
              <div className="flex justify-between font-medium text-gray-800">
                <span>Falta por pagar</span>
                <span>${(Number(reserva.totalMxn) - Number(reserva.pagoManual.montoAnticipo)).toLocaleString("es-MX")} MXN</span>
              </div>
            </div>
          )}
          {reserva.pagoManual.notas && (
            <p className="text-sm text-gray-500 mt-2">{reserva.pagoManual.notas}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Formulario de cancelación inline (task 9.5)
function CancelarDialog({
  reservaId,
  esOnline,
  totalMxn,
}: {
  reservaId: string;
  esOnline: boolean;
  totalMxn: number;
}) {
  return <CancelarDialogClient reservaId={reservaId} esOnline={esOnline} totalMxn={totalMxn} cancelarReservaAction={cancelarReservaAction} />;
}
