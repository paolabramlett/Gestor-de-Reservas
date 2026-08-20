"use client";

import { useActionState, useState } from "react";
import {
  ajustarPagoExternoAction,
  corregirPagoExternoAction,
  reenviarComprobantePagoExternoAction,
  type ResultadoPagoExternoAction,
} from "../pagosExternosActions";
import type { crearVistaLedger } from "./PagoLedger";

type MovimientoExterno = Extract<
  ReturnType<typeof crearVistaLedger>["movimientos"][number],
  { fuente: "Pago externo" }
>;

const INICIAL: ResultadoPagoExternoAction = { ok: false, mensaje: "" };

function fechaLocal(iso: string) {
  const fecha = new Date(iso);
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function AccionesPagoExterno({ reservaId, movimiento }: { reservaId: string; movimiento: MovimientoExterno }) {
  const [modo, setModo] = useState<"CORREGIR" | "ANULAR" | "REEMBOLSAR" | null>(null);
  const [clave, setClave] = useState<string | null>(null);
  const [resultadoCorreccion, corregirAction, corrigiendo] = useActionState(corregirPagoExternoAction, INICIAL);
  const [resultadoAjuste, ajustarAction, ajustando] = useActionState(ajustarPagoExternoAction, INICIAL);
  const [resultadoReenvio, reenviarAction, reenviando] = useActionState(reenviarComprobantePagoExternoAction, INICIAL);

  function abrir(siguiente: "CORREGIR" | "ANULAR" | "REEMBOLSAR") {
    setClave(crypto.randomUUID());
    setModo(siguiente);
  }

  const puedeReenviar = movimiento.controles.includes("REENVIAR");

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap gap-2">
        {movimiento.controles.includes("CORREGIR") && <button type="button" onClick={() => abrir("CORREGIR")} className="text-xs font-medium text-blue-700 hover:underline">Corregir</button>}
        {movimiento.controles.includes("ANULAR") && <button type="button" onClick={() => abrir("ANULAR")} className="text-xs font-medium text-amber-700 hover:underline">Anular</button>}
        {movimiento.controles.includes("REEMBOLSAR") && <button type="button" onClick={() => abrir("REEMBOLSAR")} className="text-xs font-medium text-red-700 hover:underline">Registrar reembolso</button>}
        {puedeReenviar && (
          <form action={reenviarAction}>
            <input type="hidden" name="reservaId" value={reservaId} />
            <input type="hidden" name="pagoExternoId" value={movimiento.id} />
            <button type="submit" disabled={reenviando} className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50">
              {reenviando ? "Reenviando…" : "Reenviar comprobante"}
            </button>
          </form>
        )}
      </div>

      {resultadoReenvio.mensaje && <p role="status" className={`mt-2 text-xs ${resultadoReenvio.ok ? "text-green-700" : "text-red-700"}`}>{resultadoReenvio.mensaje}</p>}

      {modo === "CORREGIR" && clave && (
        <form action={corregirAction} className="mt-3 space-y-3 rounded-lg bg-blue-50 p-3 text-sm">
          <input type="hidden" name="reservaId" value={reservaId} />
          <input type="hidden" name="pagoExternoId" value={movimiento.id} />
          <input type="hidden" name="idempotencyKey" value={clave} />
          <p className="text-xs text-blue-800">Original: {movimiento.monto}, {movimiento.detalle}, {new Date(movimiento.fecha).toLocaleString("es-MX")}.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input aria-label="Monto corregido" name="monto" type="number" min="0.01" step="0.01" defaultValue={(movimiento.montoCentavos / 100).toFixed(2)} required className="rounded-lg border border-blue-200 px-3 py-2" />
            <select aria-label="Método corregido" name="metodo" defaultValue={movimiento.metodo} className="rounded-lg border border-blue-200 px-3 py-2">
              <option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia</option><option value="TERMINAL_EXTERNA">Terminal externa</option><option value="OTRO">Otro</option>
            </select>
            <input aria-label="Fecha corregida" name="fechaPago" type="datetime-local" defaultValue={fechaLocal(movimiento.fecha)} required className="rounded-lg border border-blue-200 px-3 py-2" />
            <input aria-label="Nota corregida" name="nota" maxLength={500} defaultValue={movimiento.nota ?? ""} placeholder="Nota opcional" className="rounded-lg border border-blue-200 px-3 py-2" />
          </div>
          <textarea aria-label="Motivo de la corrección" name="motivo" maxLength={500} required placeholder="Motivo de la corrección" className="w-full rounded-lg border border-blue-200 px-3 py-2" />
          {resultadoCorreccion.mensaje && <p role="status" className={resultadoCorreccion.ok ? "text-green-700" : "text-red-700"}>{resultadoCorreccion.mensaje}</p>}
          <div className="flex gap-2"><button type="submit" disabled={corrigiendo} className="rounded-lg bg-blue-700 px-3 py-2 text-white disabled:opacity-50">{corrigiendo ? "Guardando…" : "Guardar corrección"}</button><button type="button" onClick={() => setModo(null)} className="px-3 py-2 text-gray-600">Cancelar</button></div>
        </form>
      )}

      {(modo === "ANULAR" || modo === "REEMBOLSAR") && clave && (
        <form action={ajustarAction} className="mt-3 space-y-3 rounded-lg bg-amber-50 p-3 text-sm">
          <input type="hidden" name="reservaId" value={reservaId} />
          <input type="hidden" name="pagoExternoId" value={movimiento.id} />
          <input type="hidden" name="tipo" value={modo === "ANULAR" ? "ANULACION" : "REEMBOLSO"} />
          <input type="hidden" name="idempotencyKey" value={clave} />
          {modo === "ANULAR" ? (
            <>
              <input type="hidden" name="monto" value={(movimiento.disponibleCentavos / 100).toFixed(2)} />
              <p className="text-amber-900">La anulación sólo cambia el registro de Roomly; no mueve dinero.</p>
              <label className="flex gap-2"><input type="checkbox" required /> Confirmo que deseo anular todo el monto disponible.</label>
            </>
          ) : (
            <>
              <p className="font-medium text-red-800">El hotel debe devolver el dinero externo por su propia cuenta; Roomly sólo asentará el reembolso.</p>
              <input aria-label="Monto reembolsado" name="monto" type="number" min="0.01" max={(movimiento.disponibleCentavos / 100).toFixed(2)} step="0.01" required className="w-full rounded-lg border border-amber-200 px-3 py-2" />
            </>
          )}
          <textarea aria-label="Motivo del ajuste" name="motivo" maxLength={500} required placeholder="Motivo obligatorio" className="w-full rounded-lg border border-amber-200 px-3 py-2" />
          {resultadoAjuste.mensaje && <p role="status" className={resultadoAjuste.ok ? "text-green-700" : "text-red-700"}>{resultadoAjuste.mensaje}</p>}
          <div className="flex gap-2"><button type="submit" disabled={ajustando} className="rounded-lg bg-gray-900 px-3 py-2 text-white disabled:opacity-50">{ajustando ? "Guardando…" : modo === "ANULAR" ? "Confirmar anulación" : "Registrar reembolso"}</button><button type="button" onClick={() => setModo(null)} className="px-3 py-2 text-gray-600">Cancelar</button></div>
        </form>
      )}
    </div>
  );
}
