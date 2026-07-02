"use client";

import { useState } from "react";
import { DatePicker } from "@/components/DatePicker";
import { crearReservaManualAction, crearReservaConPagoAction } from "../actions";
import DisponibilidadCheck from "./DisponibilidadCheck";

type Tipo = {
  id: string;
  nombre: string;
  capacidadMin: number;
  capacidadMax: number;
};

const TIPO_ESPECIAL_LABELS: Record<string, string> = {
  CORTESIA: "Cortesía",
  PRECIO_ACORDADO: "Precio acordado",
  PROMOCION: "Promoción",
};

export function NuevaReservaForm({
  tipos,
  hoy,
  manana,
  from,
}: {
  tipos: Tipo[];
  hoy: string;
  manana: string;
  from?: string;
}) {
  const [estadoDePago, setEstadoDePago] = useState("PENDIENTE");
  const [tipoEspecial, setTipoEspecial] = useState("");
  const [solicitarPago, setSolicitarPago] = useState(false);
  const [esPagoCompleto, setEsPagoCompleto] = useState(false);

  const showAnticipo = estadoDePago === "ANTICIPO_PAGADO";
  const showPrecioAcordado = tipoEspecial === "PRECIO_ACORDADO" || tipoEspecial === "PROMOCION";

  const action = solicitarPago ? crearReservaConPagoAction : crearReservaManualAction;

  return (
    <form action={action} className="space-y-5 bg-white rounded-lg border border-gray-200 p-6">
      <input type="hidden" name="from" value={from ?? ""} />

      {/* Tipo de habitación */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de habitación</label>
        <select name="tipoDeHabitacionId" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">Seleccionar...</option>
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} (cap. {t.capacidadMin}–{t.capacidadMax})
            </option>
          ))}
        </select>
      </div>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de ingreso</label>
          <DatePicker name="fechaIngreso" defaultValue={hoy} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de salida</label>
          <DatePicker name="fechaSalida" defaultValue={manana} required />
        </div>
      </div>

      {/* Personas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Número de personas</label>
        <input
          type="number"
          name="numPersonas"
          defaultValue={2}
          min={1}
          max={10}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Disponibilidad */}
      <DisponibilidadCheck />

      <hr className="border-gray-200" />

      {/* Huésped */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del huésped</label>
        <input
          type="text"
          name="nombre"
          required
          placeholder="Nombre completo"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" name="email" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input type="tel" name="telefono" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <hr className="border-gray-200" />

      {/* Tipo especial */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de reserva</label>
        <select
          name="tipoEspecial"
          value={tipoEspecial}
          onChange={(e) => setTipoEspecial(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Normal</option>
          {Object.entries(TIPO_ESPECIAL_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* Precio acordado (cuando aplica) */}
      {showPrecioAcordado && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {tipoEspecial === "PROMOCION" ? "Precio de promoción (MXN)" : "Precio acordado (MXN)"}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number"
              name="totalOverride"
              min={0}
              step="0.01"
              required
              placeholder="0.00"
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Este precio reemplazará el cálculo automático de tarifas.</p>
        </div>
      )}

      {/* Cortesía: precio = $0, solo informativo */}
      {tipoEspecial === "CORTESIA" && (
        <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-700">
          Las cortesías se registran con costo $0. El cálculo de tarifas no aplica.
        </div>
      )}

      {/* Solicitar pago con tarjeta */}
      <div className="rounded-lg border border-gray-200 p-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={solicitarPago}
            onChange={(e) => setSolicitarPago(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-gray-900"
          />
          <div>
            <span className="text-sm font-medium text-gray-800">Solicitar pago con tarjeta</span>
            <p className="text-xs text-gray-500 mt-0.5">
              El huésped recibirá un link de pago por email. La reserva se confirma automáticamente al pagar. El link expira en 24 horas.
            </p>
          </div>
        </label>

        {solicitarPago && (
          <div className="space-y-3 pl-7">
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${!esPagoCompleto ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}>
                <input
                  type="radio"
                  name="esPagoCompleto"
                  value="false"
                  checked={!esPagoCompleto}
                  onChange={() => setEsPagoCompleto(false)}
                  className="text-gray-900"
                />
                Anticipo
              </label>
              <label className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${esPagoCompleto ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}>
                <input
                  type="radio"
                  name="esPagoCompleto"
                  value="true"
                  checked={esPagoCompleto}
                  onChange={() => setEsPagoCompleto(true)}
                  className="text-gray-900"
                />
                Pago completo
              </label>
            </div>
            <input type="hidden" name="esPagoCompleto" value={esPagoCompleto ? "true" : "false"} />
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {esPagoCompleto ? "Monto total a cobrar (MXN)" : "Monto del anticipo (MXN)"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  name="montoCobrar"
                  min={1}
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Estado de pago (solo cuando NO se solicita pago con tarjeta) */}
      {!solicitarPago && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado de pago</label>
            <select
              name="estadoDePago"
              value={estadoDePago}
              onChange={(e) => setEstadoDePago(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="ANTICIPO_PAGADO">Anticipo pagado</option>
              <option value="PAGADO_COMPLETO">Pagado completo</option>
            </select>
          </div>

          {showAnticipo && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto de anticipo (MXN)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  name="montoAnticipo"
                  min={0}
                  step="0.01"
                  required
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
        <textarea
          name="notas"
          rows={3}
          placeholder="Notas opcionales..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Botones */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700"
        >
          Crear reserva
        </button>
        <a
          href={from === "calendario" ? "/panel/calendario" : "/panel/reservas"}
          className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
