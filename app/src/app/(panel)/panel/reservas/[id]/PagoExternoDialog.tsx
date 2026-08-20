"use client";

import { useActionState, useState } from "react";
import { registrarPagoExternoAction, type ResultadoPagoExternoAction } from "../pagosExternosActions";

const INICIAL: ResultadoPagoExternoAction = { ok: false, mensaje: "" };

function fechaHoraLocalAhora() {
  const ahora = new Date();
  const local = new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function PagoExternoDialog({
  reservaId,
  saldoPendienteCentavos,
}: {
  reservaId: string;
  saldoPendienteCentavos: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState<string | null>(null);
  const [resultado, action, pendiente] = useActionState(registrarPagoExternoAction, INICIAL);

  function abrir() {
    setClave(crypto.randomUUID());
    setAbierto(true);
  }

  if (!abierto || !clave) {
    return (
      <button
        type="button"
        onClick={abrir}
        className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
      >
        Registrar pago externo
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="pago-externo-titulo" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 id="pago-externo-titulo" className="font-semibold text-gray-900">Registrar pago externo</h3>
            <p className="mt-1 text-sm text-gray-500">
              Saldo pendiente: ${(saldoPendienteCentavos / 100).toLocaleString("es-MX")} MXN
            </p>
          </div>
          <button type="button" onClick={() => setAbierto(false)} className="text-sm text-gray-500 hover:text-gray-800">Cerrar</button>
        </div>

        <form action={action} className="space-y-4">
          <input type="hidden" name="reservaId" value={reservaId} />
          <input type="hidden" name="idempotencyKey" value={clave} />
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pago-externo-monto">Monto exacto</label>
            <input
              id="pago-externo-monto"
              name="monto"
              type="number"
              min="0.01"
              max={(saldoPendienteCentavos / 100).toFixed(2)}
              step="0.01"
              defaultValue={(saldoPendienteCentavos / 100).toFixed(2)}
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pago-externo-metodo">Método</label>
            <select id="pago-externo-metodo" name="metodo" defaultValue="TRANSFERENCIA" required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
              <option value="TERMINAL_EXTERNA">Terminal externa</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pago-externo-fecha">Fecha y hora local</label>
            <input id="pago-externo-fecha" name="fechaPago" type="datetime-local" defaultValue={fechaHoraLocalAhora()} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="pago-externo-nota">Nota (opcional)</label>
            <textarea id="pago-externo-nota" name="nota" maxLength={500} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="enviarComprobante" defaultChecked className="mt-0.5" />
            Enviar comprobante al huésped
          </label>
          {resultado.mensaje && (
            <p role="status" className={`rounded-lg px-3 py-2 text-sm ${resultado.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {resultado.mensaje}
            </p>
          )}
          <button type="submit" disabled={pendiente} className="w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
            {pendiente ? "Registrando…" : "Registrar pago"}
          </button>
        </form>
      </div>
    </div>
  );
}
