"use client";

import { useRef } from "react";

// ─── Shared dialog shell ──────────────────────────────────────────────────────

function ConfirmDialog({
  dialogRef,
  titulo,
  children,
  onCancel,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  titulo: string;
  children: React.ReactNode;
  onCancel: () => void;
}) {
  return (
    <dialog
      ref={dialogRef}
      className="rounded-2xl shadow-2xl border border-gray-100 p-0 w-full max-w-sm backdrop:bg-black/40"
      style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", margin: 0 }}
      onClick={(e) => { if (e.target === dialogRef.current) onCancel(); }}
    >
      <div className="p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-2">{titulo}</h3>
        {children}
      </div>
    </dialog>
  );
}

// ─── Check-in / Check-out / No-Show ──────────────────────────────────────────

type Accion = "checkin" | "checkout" | "noshow";

const META: Record<Accion, { titulo: string; mensaje: string; labelBtn: string; claseBtn: string }> = {
  checkin: {
    titulo: "Confirmar Check-in",
    mensaje: "¿Estás seguro de que deseas registrar el check-in de esta reserva?",
    labelBtn: "✓ Check-in",
    claseBtn: "rounded-lg bg-green-600 text-white px-4 py-2 text-sm font-medium hover:bg-green-700",
  },
  checkout: {
    titulo: "Confirmar Check-out",
    mensaje: "¿Estás seguro de que deseas registrar el check-out? Esto marcará la reserva como completada.",
    labelBtn: "✓ Check-out",
    claseBtn: "rounded-lg bg-gray-700 text-white px-4 py-2 text-sm font-medium hover:bg-gray-900",
  },
  noshow: {
    titulo: "Marcar como No-Show",
    mensaje: "¿Confirmas que el huésped no se presentó? Esta acción marcará la reserva como No-Show.",
    labelBtn: "No-Show",
    claseBtn: "rounded-lg border border-orange-300 text-orange-700 bg-orange-50 px-4 py-2 text-sm font-medium hover:bg-orange-100",
  },
};

function BotonConConfirmacion({
  accion,
  action,
  reservaId,
  saldoPendiente,
}: {
  accion: Accion;
  action: (fd: FormData) => Promise<void>;
  reservaId: string;
  saldoPendiente?: number | null;
}) {
  const { titulo, mensaje, labelBtn, claseBtn } = META[accion];
  const dialogRef = useRef<HTMLDialogElement>(null);

  const cerrar = () => dialogRef.current?.close();

  return (
    <>
      <button type="button" onClick={() => dialogRef.current?.showModal()} className={claseBtn}>
        {labelBtn}
      </button>

      <ConfirmDialog dialogRef={dialogRef} titulo={titulo} onCancel={cerrar}>
        <p className="text-sm text-gray-500 mb-4">{mensaje}</p>

        {accion === "checkin" && saldoPendiente && saldoPendiente > 0 && (
          <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-2.5 items-start">
            <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-amber-800">Saldo pendiente de cobro</p>
              <p className="text-sm text-amber-700 mt-0.5">
                El huésped tiene un saldo pendiente de{" "}
                <span className="font-bold">${saldoPendiente.toLocaleString("es-MX")} MXN</span>.
                Verifica el cobro antes o durante el check-in.
              </p>
            </div>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={cerrar}
            className="rounded-lg border border-gray-200 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          <form action={action}>
            <input type="hidden" name="reservaId" value={reservaId} />
            <button
              type="submit"
              onClick={cerrar}
              className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700"
            >
              Confirmar
            </button>
          </form>
        </div>
      </ConfirmDialog>
    </>
  );
}

export function BotonesEstadoReserva({
  reservaId,
  estado,
  checkInAction,
  checkOutAction,
  noShowAction,
  saldoPendiente,
}: {
  reservaId: string;
  estado: string;
  checkInAction: (fd: FormData) => Promise<void>;
  checkOutAction: (fd: FormData) => Promise<void>;
  noShowAction: (fd: FormData) => Promise<void>;
  saldoPendiente?: number | null;
}) {
  return (
    <>
      {estado === "CONFIRMADA" && (
        <BotonConConfirmacion accion="checkin" action={checkInAction} reservaId={reservaId} saldoPendiente={saldoPendiente} />
      )}
      {estado === "EN_CURSO" && (
        <BotonConConfirmacion accion="checkout" action={checkOutAction} reservaId={reservaId} />
      )}
      {estado === "CONFIRMADA" && (
        <BotonConConfirmacion accion="noshow" action={noShowAction} reservaId={reservaId} />
      )}
    </>
  );
}

// ─── Cancelar reserva ─────────────────────────────────────────────────────────

export function CancelarDialogClient({
  reservaId,
  esOnline,
  totalMxn,
  cancelarReservaAction,
}: {
  reservaId: string;
  esOnline: boolean;
  totalMxn: number;
  cancelarReservaAction: (fd: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cerrar = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-lg border border-red-300 text-red-600 bg-red-50 px-4 py-2 text-sm font-medium hover:bg-red-100"
      >
        Cancelar reserva
      </button>

      <ConfirmDialog dialogRef={dialogRef} titulo="Cancelar reserva" onCancel={cerrar}>
        <p className="text-sm text-gray-500 mb-4">Esta acción no se puede deshacer.</p>
        <form action={cancelarReservaAction} className="space-y-3">
          <input type="hidden" name="reservaId" value={reservaId} />
          {esOnline ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Política de reembolso</label>
                <select
                  name="politicaReembolso"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="TOTAL">Reembolso total (${totalMxn.toLocaleString("es-MX")} MXN)</option>
                  <option value="PARCIAL">Reembolso parcial</option>
                  <option value="SIN_REEMBOLSO">Sin reembolso</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Monto a reembolsar (si parcial)</label>
                <input
                  type="number"
                  name="montoParcialMxn"
                  min={0}
                  max={totalMxn}
                  step="0.01"
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>
          ) : (
            <input type="hidden" name="politicaReembolso" value="SIN_REEMBOLSO" />
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-lg border border-gray-200 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              onClick={cerrar}
              className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700"
            >
              Confirmar cancelación
            </button>
          </div>
        </form>
      </ConfirmDialog>
    </>
  );
}
