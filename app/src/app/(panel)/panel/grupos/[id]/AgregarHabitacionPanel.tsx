"use client";

import { useState } from "react";
import { agregarHabitacionAlGrupoAction, vincularReservaAlGrupoAction } from "../actions";
import { calcularTotalPreviewAction } from "../../reservas/actions";

type Tipo = { id: string; nombre: string };

export function AgregarHabitacionPanel({
  grupoId,
  tipos,
  emailContacto,
  nombreContacto,
}: {
  grupoId: string;
  tipos: Tipo[];
  emailContacto?: string;
  nombreContacto?: string;
}) {
  const [tab, setTab] = useState<"nueva" | "vincular">("nueva");
  const [tipoId, setTipoId] = useState(tipos[0]?.id ?? "");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [fechaSalida, setFechaSalida] = useState("");
  const [numPersonas, setNumPersonas] = useState(1);
  const [preview, setPreview] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [open, setOpen] = useState(false);

  const calcularPreview = async () => {
    if (!tipoId || !fechaIngreso || !fechaSalida || fechaSalida <= fechaIngreso) return;
    setLoadingPreview(true);
    const { total } = await calcularTotalPreviewAction(tipoId, fechaIngreso, fechaSalida, numPersonas);
    setPreview(total);
    setLoadingPreview(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border-2 border-dashed border-gray-300 text-gray-500 py-4 text-sm font-medium hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Agregar habitación al grupo
      </button>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Agregar habitación</h3>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border border-gray-200 rounded-lg p-1 mb-5 gap-1">
        <button
          type="button"
          onClick={() => setTab("nueva")}
          className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${tab === "nueva" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"}`}
        >
          Nueva reserva
        </button>
        <button
          type="button"
          onClick={() => setTab("vincular")}
          className={`flex-1 text-sm py-1.5 rounded-md font-medium transition-colors ${tab === "vincular" ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"}`}
        >
          Vincular existente
        </button>
      </div>

      {tab === "vincular" ? (
        <form action={vincularReservaAlGrupoAction} className="space-y-4">
          <input type="hidden" name="grupoId" value={grupoId} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Código de reserva</label>
            <input
              name="codigoReserva"
              required
              placeholder="RES-XXXX-XXXX"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 uppercase"
              style={{ textTransform: "uppercase" }}
            />
            <p className="text-xs text-gray-400 mt-1">Ingresa el código de una reserva existente para vincularla a este grupo.</p>
          </div>
          <button type="submit" className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium hover:bg-gray-700">
            Vincular reserva
          </button>
        </form>
      ) : (
        <form action={agregarHabitacionAlGrupoAction} className="space-y-4">
          <input type="hidden" name="grupoId" value={grupoId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de habitación</label>
              <select
                name="tipoDeHabitacionId"
                required
                value={tipoId}
                onChange={(e) => { setTipoId(e.target.value); setPreview(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in</label>
              <input
                type="date"
                name="fechaIngreso"
                required
                value={fechaIngreso}
                onChange={(e) => { setFechaIngreso(e.target.value); setPreview(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-out</label>
              <input
                type="date"
                name="fechaSalida"
                required
                value={fechaSalida}
                onChange={(e) => { setFechaSalida(e.target.value); setPreview(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Personas</label>
              <input
                type="number"
                name="numPersonas"
                required
                min={1}
                value={numPersonas}
                onChange={(e) => { setNumPersonas(Number(e.target.value)); setPreview(null); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Estado de pago</label>
              <select name="estadoDePago" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="PENDIENTE">Pendiente</option>
                <option value="ANTICIPO_PAGADO">Anticipo pagado</option>
                <option value="PAGADO_COMPLETO">Pagado completo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del huésped</label>
            <input
              name="nombre"
              required
              defaultValue={nombreContacto}
              placeholder="Nombre del huésped en esta habitación"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Correo</label>
              <input
                name="email"
                type="email"
                required
                defaultValue={emailContacto}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Teléfono</label>
              <input
                name="telefono"
                type="tel"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notas <span className="text-gray-400 font-normal">(opcional)</span></label>
            <input
              name="notas"
              placeholder="Cama extra, piso alto, etc."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* Preview */}
          {!preview ? (
            <button
              type="button"
              onClick={calcularPreview}
              disabled={loadingPreview || !fechaIngreso || !fechaSalida || fechaSalida <= fechaIngreso}
              className="w-full rounded-lg bg-gray-100 text-gray-700 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              {loadingPreview ? "Calculando..." : "Calcular precio"}
            </button>
          ) : (
            <div className="bg-gray-50 rounded-lg px-4 py-3 flex justify-between items-center text-sm">
              <span className="text-gray-600">Total estimado</span>
              <span className="font-bold text-gray-900">${preview.toLocaleString("es-MX")} MXN</span>
            </div>
          )}

          <button type="submit" className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-semibold hover:bg-gray-700">
            Agregar habitación
          </button>
        </form>
      )}
    </div>
  );
}
