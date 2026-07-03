"use client";

import { useRef, useState } from "react";
import { solicitarPagoGrupoAction } from "../actions";

export function SolicitarPagoGrupo({
  grupoId,
  totalGrupo,
  totalPagado,
  restante,
  emailContacto,
}: {
  grupoId: string;
  totalGrupo: number;
  totalPagado: number;
  restante: number;
  emailContacto: string;
}) {
  const [open, setOpen] = useState(false);
  const [esPagoCompleto, setEsPagoCompleto] = useState(false);
  const [monto, setMonto] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const montoNum = Number(monto);
  const montoInvalido = montoNum <= 0 || montoNum > restante;

  function handleTipoChange(completo: boolean) {
    setEsPagoCompleto(completo);
    setMonto(completo ? String(restante) : "");
    setError(null);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-semibold hover:bg-gray-700 flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 21z" />
        </svg>
        Solicitar pago del grupo
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Solicitar pago</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {totalPagado > 0 && (
        <div className="mb-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between text-gray-500">
            <span>Total grupo</span>
            <span>${totalGrupo.toLocaleString("es-MX")} MXN</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>Ya pagado</span>
            <span>${totalPagado.toLocaleString("es-MX")} MXN</span>
          </div>
          <div className="flex justify-between text-amber-700 font-semibold border-t border-gray-200 pt-1">
            <span>Restante</span>
            <span>${restante.toLocaleString("es-MX")} MXN</span>
          </div>
        </div>
      )}

      <form
        ref={formRef}
        action={async (fd) => {
          if (montoInvalido) {
            setError(`El monto debe ser entre $1 y $${restante.toLocaleString("es-MX")} MXN`);
            return;
          }
          setPending(true);
          setError(null);
          await solicitarPagoGrupoAction(fd);
          setPending(false);
        }}
        className="space-y-3"
      >
        <input type="hidden" name="grupoId" value={grupoId} />
        <input type="hidden" name="esPagoCompleto" value={String(esPagoCompleto)} />

        <div>
          <label className="block text-xs text-gray-500 mb-1">Tipo de pago</label>
          <div className="flex border border-gray-200 rounded-lg p-1 gap-1">
            {[
              { value: false, label: "Anticipo" },
              { value: true, label: "Liquidar saldo" },
            ].map(({ value, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => handleTipoChange(value)}
                className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${
                  esPagoCompleto === value
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Monto a cobrar (MXN)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
            <input
              name="monto"
              type="number"
              required
              min={1}
              max={restante}
              step="0.01"
              value={monto}
              onChange={(e) => { setMonto(e.target.value); setError(null); }}
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Máximo cobrable: <span className="font-medium">${restante.toLocaleString("es-MX")} MXN</span>
          </p>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-700">
          Se enviará un link de Stripe a <span className="font-medium">{emailContacto}</span>. Expira en 24 horas.
        </div>

        <button
          type="submit"
          disabled={pending || !monto || montoNum <= 0}
          className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-semibold hover:bg-gray-700 disabled:opacity-50"
        >
          {pending ? "Enviando link..." : "Enviar link de pago"}
        </button>
      </form>
    </div>
  );
}
