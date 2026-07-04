"use client";

import { useState } from "react";

type Props = {
  reservaId: string;
  totalMxn: number;
  estadoDePagoInicial: string;
  montoAnticipoInicial: number;
  notasIniciales: string;
  actualizarPagoYNotasAction: (fd: FormData) => Promise<void>;
};

export function PagoForm({
  reservaId,
  totalMxn,
  estadoDePagoInicial,
  montoAnticipoInicial,
  notasIniciales,
  actualizarPagoYNotasAction,
}: Props) {
  const [estado, setEstado] = useState(estadoDePagoInicial);
  const [anticipo, setAnticipo] = useState(montoAnticipoInicial);

  const resta = Math.max(0, totalMxn - anticipo);
  const mostrarAnticipo = estado === "ANTICIPO_PAGADO";

  return (
    <form action={actualizarPagoYNotasAction} className="space-y-4">
      <input type="hidden" name="reservaId" value={reservaId} />

      <div>
        <label className="block text-xs text-gray-500 mb-1">Estado de pago</label>
        <select
          name="estadoDePago"
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="PENDIENTE">Pendiente</option>
          <option value="ANTICIPO_PAGADO">Anticipo pagado</option>
          <option value="PAGADO_COMPLETO">Pagado completo</option>
        </select>
      </div>

      {mostrarAnticipo && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Monto del anticipo (MXN)
          </label>
          <input
            type="number"
            name="montoAnticipo"
            min={0}
            max={totalMxn}
            step="0.01"
            value={anticipo || ""}
            onChange={(e) => setAnticipo(Number(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          {anticipo > 0 && (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm space-y-1">
              <div className="flex justify-between text-gray-600">
                <span>Total reserva</span>
                <span>${totalMxn.toLocaleString("es-MX")} MXN</span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>Anticipo pagado</span>
                <span>− ${anticipo.toLocaleString("es-MX")} MXN</span>
              </div>
              <div className="flex justify-between font-semibold text-amber-800 pt-1 border-t border-amber-200">
                <span>Resta al check-in</span>
                <span>${resta.toLocaleString("es-MX")} MXN</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs text-gray-500 mb-1">Notas internas</label>
        <textarea
          name="notas"
          rows={3}
          defaultValue={notasIniciales}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700"
      >
        Guardar cambios
      </button>
    </form>
  );
}
