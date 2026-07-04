"use client";

import { useRef, useState } from "react";

type Props = {
  reservaId: string;
  totalMxn: number;
  estadoDePagoInicial: string;
  montoAnticipoInicial: number;
  notasIniciales: string;
  actualizarPagoYNotasAction: (fd: FormData) => Promise<void>;
};

const LABEL_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ANTICIPO_PAGADO: "Anticipo pagado",
  PAGADO_COMPLETO: "Pagado completo",
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
  const [confirmar, setConfirmar] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const bypassRef = useRef(false);

  const resta = Math.max(0, totalMxn - anticipo);
  const mostrarAnticipo = estado === "ANTICIPO_PAGADO";

  // Bajar de "Pagado completo" a un estado menor es una acción sensible:
  // pedir confirmación para evitar cambios accidentales.
  const esDowngrade =
    estadoDePagoInicial === "PAGADO_COMPLETO" && estado !== "PAGADO_COMPLETO";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (esDowngrade && !bypassRef.current) {
      e.preventDefault();
      setConfirmar(true);
    }
  }

  return (
    <form
      ref={formRef}
      action={actualizarPagoYNotasAction}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
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

      {confirmar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">
              ¿Cambiar el estado de pago?
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              Esta reserva está marcada como <strong>Pagado completo</strong> y la
              vas a cambiar a <strong>{LABEL_ESTADO[estado]}</strong>. Confirma que
              el pago realmente cambió — este dato afecta el saldo y los reportes.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmar(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmar(false);
                  bypassRef.current = true;
                  formRef.current?.requestSubmit();
                }}
                className="flex-1 rounded-lg bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-700"
              >
                Sí, cambiar el pago
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
