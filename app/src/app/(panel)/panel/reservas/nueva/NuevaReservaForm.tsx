"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { crearReservaManualAction, crearReservaConPagoAction } from "../actions";
import { crearGrupoConHabitacionesAction } from "../../grupos/actions";
import type { HabitacionInput } from "../../grupos/actions";
import { EstadoDePago } from "@prisma/client";

type Tipo = {
  id: string;
  nombre: string;
  capacidadMin: number;
  capacidadMax: number;
};

type Habitacion = {
  id: string;
  tipoDeHabitacionId: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  notas: string;
};

const TIPO_ESPECIAL_LABELS: Record<string, string> = {
  CORTESIA: "Cortesía",
  PRECIO_ACORDADO: "Precio acordado",
  PROMOCION: "Promoción",
};

function makeHab(hoy: string, manana: string, tipos: Tipo[]): Habitacion {
  return {
    id: Math.random().toString(36).slice(2),
    tipoDeHabitacionId: tipos[0]?.id ?? "",
    fechaIngreso: hoy,
    fechaSalida: manana,
    numPersonas: 2,
    notas: "",
  };
}

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
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Guest info
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  // Rooms
  const [habitaciones, setHabitaciones] = useState<Habitacion[]>([makeHab(hoy, manana, tipos)]);

  // Payment (shared)
  const [estadoDePago, setEstadoDePago] = useState("PENDIENTE");
  const [montoAnticipo, setMontoAnticipo] = useState("");
  const [solicitarPago, setSolicitarPago] = useState(false);
  const [esPagoCompleto, setEsPagoCompleto] = useState(false);
  const [montoCobrar, setMontoCobrar] = useState("");

  // Single-room extras
  const [tipoEspecial, setTipoEspecial] = useState("");
  const [totalOverride, setTotalOverride] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMulti = habitaciones.length > 1;
  const cancelUrl = from === "calendario" ? "/panel/calendario" : "/panel/reservas";

  const updateHab = useCallback((id: string, field: keyof Habitacion, value: string | number) => {
    setHabitaciones((prev) => prev.map((h) => h.id === id ? { ...h, [field]: value } : h));
  }, []);

  const addHab = () => setHabitaciones((prev) => [...prev, makeHab(prev[0].fechaIngreso, prev[0].fechaSalida, tipos)]);
  const removeHab = (id: string) => setHabitaciones((prev) => prev.filter((h) => h.id !== id));

  const copyDatesFromFirst = () => {
    const first = habitaciones[0];
    setHabitaciones((prev) => prev.map((h) => ({ ...h, fechaIngreso: first.fechaIngreso, fechaSalida: first.fechaSalida })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) { setError("Nombre y correo son obligatorios"); return; }
    if (habitaciones.some((h) => !h.tipoDeHabitacionId || !h.fechaIngreso || !h.fechaSalida || h.fechaSalida <= h.fechaIngreso)) {
      setError("Revisa las fechas de cada habitación"); return;
    }

    setSubmitting(true);
    setError(null);

    if (!isMulti) {
      // Single room — use existing form actions
      const fd = new FormData(formRef.current!);
      fd.set("nombre", nombre);
      fd.set("email", email);
      fd.set("telefono", telefono);
      fd.set("tipoDeHabitacionId", habitaciones[0].tipoDeHabitacionId);
      fd.set("fechaIngreso", habitaciones[0].fechaIngreso);
      fd.set("fechaSalida", habitaciones[0].fechaSalida);
      fd.set("numPersonas", String(habitaciones[0].numPersonas));
      fd.set("notas", habitaciones[0].notas);
      if (tipoEspecial) fd.set("tipoEspecial", tipoEspecial);
      if (totalOverride) fd.set("totalOverride", totalOverride);
      if (solicitarPago) {
        fd.set("montoCobrar", montoCobrar);
        fd.set("esPagoCompleto", String(esPagoCompleto));
        await crearReservaConPagoAction(fd);
      } else {
        fd.set("estadoDePago", estadoDePago);
        if (estadoDePago === "ANTICIPO_PAGADO" && montoAnticipo) fd.set("montoAnticipo", montoAnticipo);
        await crearReservaManualAction(fd);
      }
      // actions redirect — no need to navigate here
    } else {
      // Multiple rooms — create group silently
      const habs: HabitacionInput[] = habitaciones.map((h) => ({
        tipoDeHabitacionId: h.tipoDeHabitacionId,
        fechaIngreso: h.fechaIngreso,
        fechaSalida: h.fechaSalida,
        numPersonas: h.numPersonas,
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim() || undefined,
        estadoDePago: estadoDePago as EstadoDePago,
        notas: h.notas || undefined,
      }));

      const result = await crearGrupoConHabitacionesAction(nombre.trim(), "", habs);
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      router.push(`/panel/grupos/${result.grupoId}?success=${encodeURIComponent("Reserva creada con " + habitaciones.length + " habitaciones")}`);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="from" value={from ?? ""} />

      {/* ── Datos del huésped ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Datos del huésped</h2>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Nombre completo</label>
          <input
            type="text"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre completo"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Correo</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>
      </div>

      {/* ── Habitaciones ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">
            Habitaciones <span className="text-gray-400 font-normal">({habitaciones.length})</span>
          </h2>
          {isMulti && (
            <button type="button" onClick={copyDatesFromFirst} className="text-xs text-blue-600 hover:underline">
              Copiar fechas de hab. 1 a todas
            </button>
          )}
        </div>

        {habitaciones.map((h, idx) => (
          <div key={h.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Habitación {idx + 1}
              </span>
              {habitaciones.length > 1 && (
                <button type="button" onClick={() => removeHab(h.id)} className="text-xs text-gray-400 hover:text-red-500">
                  Quitar
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de habitación</label>
              <select
                required
                value={h.tipoDeHabitacionId}
                onChange={(e) => updateHab(h.id, "tipoDeHabitacionId", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                {tipos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre} (cap. {t.capacidadMin}–{t.capacidadMax})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
                <input
                  type="date"
                  required
                  value={h.fechaIngreso}
                  onChange={(e) => updateHab(h.id, "fechaIngreso", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
                <input
                  type="date"
                  required
                  value={h.fechaSalida}
                  onChange={(e) => updateHab(h.id, "fechaSalida", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Personas</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={h.numPersonas}
                  onChange={(e) => updateHab(h.id, "numPersonas", Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notas <span className="font-normal text-gray-400">(opcional)</span></label>
                <input
                  type="text"
                  value={h.notas}
                  onChange={(e) => updateHab(h.id, "notas", e.target.value)}
                  placeholder="Cama extra, vista, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Tipo especial / precio acordado solo para habitación única */}
            {!isMulti && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de reserva</label>
                  <select
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
                {(tipoEspecial === "PRECIO_ACORDADO" || tipoEspecial === "PROMOCION") && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      {tipoEspecial === "PROMOCION" ? "Precio de promoción (MXN)" : "Precio acordado (MXN)"}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        required
                        value={totalOverride}
                        onChange={(e) => setTotalOverride(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                )}
                {tipoEspecial === "CORTESIA" && (
                  <div className="rounded-lg bg-purple-50 border border-purple-200 px-4 py-3 text-sm text-purple-700">
                    Las cortesías se registran con costo $0.
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addHab}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 text-gray-500 py-3 text-sm font-medium hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Agregar habitación
        </button>
      </div>

      {/* ── Pago ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Pago</h2>

        {!isMulti && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={solicitarPago}
              onChange={(e) => setSolicitarPago(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-gray-900"
            />
            <div>
              <span className="text-sm font-medium text-gray-800">Solicitar pago con tarjeta</span>
              <p className="text-xs text-gray-500 mt-0.5">
                El huésped recibirá un link de pago por email. Expira en 24 horas.
              </p>
            </div>
          </label>
        )}

        {isMulti && (
          <p className="text-xs text-gray-400">
            Para reservas multi-habitación puedes solicitar el pago por tarjeta desde el detalle de la reserva una vez creada.
          </p>
        )}

        {!isMulti && solicitarPago ? (
          <div className="space-y-3 pl-7">
            <div className="flex gap-3">
              {[{ v: false, label: "Anticipo" }, { v: true, label: "Pago completo" }].map(({ v, label }) => (
                <label key={label} className={`flex-1 flex items-center gap-2 border rounded-lg px-3 py-2.5 cursor-pointer text-sm ${esPagoCompleto === v ? "border-gray-900 bg-gray-50" : "border-gray-200"}`}>
                  <input type="radio" checked={esPagoCompleto === v} onChange={() => setEsPagoCompleto(v)} className="text-gray-900" />
                  {label}
                </label>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                {esPagoCompleto ? "Monto total a cobrar (MXN)" : "Monto del anticipo (MXN)"}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={montoCobrar}
                  onChange={(e) => setMontoCobrar(e.target.value)}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Estado de pago</label>
              <select
                value={estadoDePago}
                onChange={(e) => setEstadoDePago(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="PENDIENTE">Pendiente</option>
                <option value="ANTICIPO_PAGADO">Anticipo pagado</option>
                <option value="PAGADO_COMPLETO">Pagado completo</option>
              </select>
            </div>
            {estadoDePago === "ANTICIPO_PAGADO" && !isMulti && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Monto de anticipo (MXN)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    value={montoAnticipo}
                    onChange={(e) => setMontoAnticipo(e.target.value)}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Error ───────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Acciones ────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-gray-900 text-white px-5 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
        >
          {submitting ? "Creando..." : isMulti ? `Crear reserva (${habitaciones.length} hab.)` : "Crear reserva"}
        </button>
        <a
          href={cancelUrl}
          className="rounded-lg border border-gray-300 text-gray-700 px-5 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
