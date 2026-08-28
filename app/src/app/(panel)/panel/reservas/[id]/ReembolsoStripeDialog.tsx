"use client";

import { useActionState, useState } from "react";
import { reembolsarStripeAction, type ResultadoReembolsoStripe } from "../reembolsoStripeActions";

const inicial: ResultadoReembolsoStripe = { ok: false, mensaje: "" };

export function ReembolsoStripeDialog({ reservaId, maximoCentavos }: { reservaId: string; maximoCentavos: number }) {
  const [abierto, setAbierto] = useState(false);
  const [resultado, action, pendiente] = useActionState(reembolsarStripeAction, inicial);
  if (maximoCentavos <= 0) return null;
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="text-xs font-medium text-red-700 hover:underline">Reembolsar Stripe</button>
      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="reembolso-stripe-titulo">
          <form action={action} className="w-full max-w-md space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <h2 id="reembolso-stripe-titulo" className="text-lg font-semibold text-gray-900">Reembolsar pago Stripe</h2>
            <p className="text-sm text-gray-600">Disponible para reembolso: <strong>${(maximoCentavos / 100).toLocaleString("es-MX")} MXN</strong></p>
            <input type="hidden" name="reservaId" value={reservaId} />
            <label className="block text-sm text-gray-700">Monto a reembolsar<input name="monto" type="number" min="0.01" max={(maximoCentavos / 100).toFixed(2)} step="0.01" defaultValue={(maximoCentavos / 100).toFixed(2)} required className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
            <label className="block text-sm text-gray-700">Motivo<textarea name="motivo" maxLength={500} required placeholder="Motivo del reembolso" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
            {resultado.mensaje && <p role="status" className={resultado.ok ? "text-sm text-green-700" : "text-sm text-red-700"}>{resultado.mensaje}</p>}
            <div className="flex justify-end gap-3"><button type="button" onClick={() => setAbierto(false)} className="px-3 py-2 text-sm text-gray-600">Cancelar</button><button type="submit" disabled={pendiente} className="rounded-lg bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50">{pendiente ? "Enviando…" : "Confirmar reembolso"}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
