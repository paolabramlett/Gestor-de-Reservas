import { getCurrentUsuario } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  asignarHabitacionAction,
  actualizarPagoYNotasAction,
} from "../actions";
import {
  checkInAction,
  checkOutAction,
  noShowAction,
  cancelarReservaAction,
} from "../cicloDeVidaActions";

const ESTADO_LABEL: Record<string, string> = {
  CONFIRMADA: "Confirmada",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
  NO_SHOW: "No-Show",
};

const ESTADO_COLOR: Record<string, string> = {
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
    },
  });
  if (!reserva) notFound();

  const habitacionesDelTipo = await prisma.habitacion.findMany({
    where: {
      propiedadId: usuario.propiedadId,
      tipoDeHabitacionId: reserva.tipoDeHabitacionId,
      activa: true,
    },
    orderBy: { numero: "asc" },
  });

  const esPagoManual = reserva.origen === "MANUAL";
  const esOnline = reserva.origen === "ONLINE";
  const estado = reserva.estado;

  const esEditable = estado === "CONFIRMADA" || estado === "EN_CURSO";

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

      {/* Error de operación */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* Acciones de ciclo de vida (task 9.1–9.5) */}
      {esEditable && (
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Check-in: solo si CONFIRMADA */}
          {estado === "CONFIRMADA" && (
            <form action={checkInAction}>
              <input type="hidden" name="reservaId" value={reserva.id} />
              <button
                type="submit"
                className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700"
              >
                ✓ Check-in
              </button>
            </form>
          )}

          {/* Check-out: solo si EN_CURSO */}
          {estado === "EN_CURSO" && (
            <form action={checkOutAction}>
              <input type="hidden" name="reservaId" value={reserva.id} />
              <button
                type="submit"
                className="rounded-lg bg-gray-700 text-white px-4 py-2 text-sm font-medium hover:bg-gray-900"
              >
                ✓ Check-out
              </button>
            </form>
          )}

          {/* No-Show: solo si CONFIRMADA */}
          {estado === "CONFIRMADA" && (
            <form action={noShowAction}>
              <input type="hidden" name="reservaId" value={reserva.id} />
              <button
                type="submit"
                className="rounded-lg border border-orange-300 text-orange-700 bg-orange-50 px-4 py-2 text-sm font-medium hover:bg-orange-100"
              >
                No-Show
              </button>
            </form>
          )}

          {/* Cancelar */}
          <CancelarDialog reservaId={reserva.id} esOnline={esOnline} totalMxn={Number(reserva.totalMxn)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Detalles de la reserva */}
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

        {/* Huésped */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Huésped</h2>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-gray-500">Nombre</dt>
              <dd className="text-gray-900 font-medium">{reserva.huesped.nombre}</dd>
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

      {/* Asignación de habitación */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Habitación asignada</h2>
        {reserva.asignacion ? (
          <p className="text-sm text-gray-700 mb-3">
            Hab. <span className="font-medium">{reserva.asignacion.habitacion.numero}</span>
          </p>
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

      {/* Pago y notas — solo reservas manuales editables */}
      {esPagoManual && esEditable && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Pago y notas</h2>

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
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer rounded-lg border border-red-300 text-red-600 bg-red-50 px-4 py-2 text-sm font-medium hover:bg-red-100 select-none">
        Cancelar reserva
      </summary>
      <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80">
        <p className="text-sm font-medium text-gray-800 mb-3">¿Confirmar cancelación?</p>
        <form action={cancelarReservaAction} className="space-y-3">
          <input type="hidden" name="reservaId" value={reservaId} />
          {esOnline ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Política de reembolso</label>
              <select name="politicaReembolso" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="TOTAL">Reembolso total (${totalMxn.toLocaleString("es-MX")} MXN)</option>
                <option value="PARCIAL">Reembolso parcial</option>
                <option value="SIN_REEMBOLSO">Sin reembolso</option>
              </select>
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">Monto a reembolsar (si parcial)</label>
                <input
                  type="number"
                  name="montoParcialMxn"
                  min={0}
                  max={totalMxn}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          ) : (
            <input type="hidden" name="politicaReembolso" value="SIN_REEMBOLSO" />
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700"
          >
            Confirmar cancelación
          </button>
        </form>
      </div>
    </details>
  );
}
