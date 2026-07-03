"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { calcularTotalPreviewAction } from "@/app/(panel)/panel/reservas/actions";

type TipoSimple = {
  id: string;
  nombre: string;
  capacidadMin: number;
  capacidadMax: number;
};

type NocheDesglose = {
  fecha: string;
  precio: number;
  temporadaNombre?: string;
};

type HabExtra = {
  id: string;
  tipoDeHabitacionId: string;
  tipoNombre: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  totalMxn: number;
};

type Props = {
  slug: string;
  tipoDeHabitacionId: string;
  tipoNombre: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  totalMxn: number;
  desglose: NocheDesglose[];
  stripePublishableKey: string;
  colorPrimario?: string;
  tipos: TipoSimple[];
};

// ── Embedded Stripe payment form (single room) ──────────────────────────────

function PagoForm({
  slug,
  totalMxn,
  colorPrimario,
}: {
  slug: string;
  totalMxn: number;
  colorPrimario: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setCargando(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/p/${slug}/confirmacion` },
    });
    if (stripeError) setError(stripeError.message ?? "Error al procesar el pago");
    setCargando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      <button
        type="submit"
        disabled={!stripe || cargando}
        style={{ backgroundColor: colorPrimario }}
        className="w-full rounded-xl text-white py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {cargando ? "Procesando..." : `Pagar $${totalMxn.toLocaleString("es-MX")} MXN`}
      </button>
      <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        Pago seguro procesado por Stripe
      </div>
    </form>
  );
}

// ── Panel para agregar una habitación extra ─────────────────────────────────

function AgregarHabitacionPanel({
  tipos,
  fechaIngresoPrincipal,
  fechaSalidaPrincipal,
  colorPrimario,
  onAgregar,
  onCancelar,
}: {
  tipos: TipoSimple[];
  fechaIngresoPrincipal: string;
  fechaSalidaPrincipal: string;
  colorPrimario: string;
  onAgregar: (hab: HabExtra) => void;
  onCancelar: () => void;
}) {
  const [tipoId, setTipoId] = useState(tipos[0]?.id ?? "");
  const [fechaIngreso, setFechaIngreso] = useState(fechaIngresoPrincipal);
  const [fechaSalida, setFechaSalida] = useState(fechaSalidaPrincipal);
  const [numPersonas, setNumPersonas] = useState(2);
  const [total, setTotal] = useState<number | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [errorCalculo, setErrorCalculo] = useState<string | null>(null);

  const tipoActual = tipos.find((t) => t.id === tipoId);
  const capacidadMax = tipoActual?.capacidadMax ?? 99;
  const capacidadMin = tipoActual?.capacidadMin ?? 1;

  async function calcularPrecio(tid: string, fi: string, fo: string, np: number) {
    if (!tid || !fi || !fo || fo <= fi) { setTotal(null); return; }
    setCalculando(true);
    setErrorCalculo(null);
    const result = await calcularTotalPreviewAction(tid, fi, fo, np);
    if (result.error) setErrorCalculo("No se pudo calcular el precio");
    else setTotal(result.total);
    setCalculando(false);
  }

  function handleTipoChange(tid: string) {
    setTipoId(tid);
    const t = tipos.find((x) => x.id === tid);
    // Clamp numPersonas to new tipo's capacity
    const np = Math.min(Math.max(numPersonas, t?.capacidadMin ?? 1), t?.capacidadMax ?? 99);
    setNumPersonas(np);
    calcularPrecio(tid, fechaIngreso, fechaSalida, np);
  }

  function handlePersonasChange(val: number) {
    const np = Math.min(Math.max(val, capacidadMin), capacidadMax);
    setNumPersonas(np);
    calcularPrecio(tipoId, fechaIngreso, fechaSalida, np);
  }

  function handleFechaIngreso(fi: string) {
    setFechaIngreso(fi);
    calcularPrecio(tipoId, fi, fechaSalida, numPersonas);
  }

  function handleFechaSalida(fo: string) {
    setFechaSalida(fo);
    calcularPrecio(tipoId, fechaIngreso, fo, numPersonas);
  }

  function handleAgregar() {
    if (!total || fechaSalida <= fechaIngreso) return;
    onAgregar({
      id: Math.random().toString(36).slice(2),
      tipoDeHabitacionId: tipoId,
      tipoNombre: tipoActual?.nombre ?? "",
      fechaIngreso,
      fechaSalida,
      numPersonas,
      totalMxn: total,
    });
  }

  const fmtFecha = (s: string) =>
    new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-800">Habitación adicional</p>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipo de habitación</label>
        <select
          value={tipoId}
          onChange={(e) => handleTipoChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{ "--tw-ring-color": colorPrimario } as React.CSSProperties}
        >
          {tipos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre} (cap. {t.capacidadMin}–{t.capacidadMax})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Check-in</label>
          <input
            type="date"
            value={fechaIngreso}
            onChange={(e) => handleFechaIngreso(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Check-out</label>
          <input
            type="date"
            value={fechaSalida}
            onChange={(e) => handleFechaSalida(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">
          Personas{" "}
          <span className="text-gray-400 font-normal">(máx. {capacidadMax})</span>
        </label>
        <input
          type="number"
          min={capacidadMin}
          max={capacidadMax}
          value={numPersonas}
          onChange={(e) => handlePersonasChange(Number(e.target.value))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        {numPersonas > capacidadMax && (
          <p className="text-xs text-red-500 mt-1">
            Esta habitación tiene capacidad máxima de {capacidadMax} personas.
          </p>
        )}
      </div>

      {calculando && <p className="text-xs text-gray-400">Calculando precio...</p>}
      {errorCalculo && <p className="text-xs text-red-500">{errorCalculo}</p>}
      {total !== null && !calculando && (
        <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 flex justify-between text-sm">
          <span className="text-gray-500">
            {fmtFecha(fechaIngreso)} → {fmtFecha(fechaSalida)} · {numPersonas} persona{numPersonas !== 1 ? "s" : ""}
          </span>
          <span className="font-semibold text-gray-900">${total.toLocaleString("es-MX")} MXN</span>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={handleAgregar}
          disabled={!total || calculando || fechaSalida <= fechaIngreso || numPersonas > capacidadMax}
          style={{ backgroundColor: colorPrimario }}
          className="flex-1 rounded-lg text-white py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          Confirmar habitación
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg border border-gray-300 text-gray-600 px-4 py-2 text-sm hover:bg-gray-100"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────

export default function FormularioReserva(props: Props) {
  const colorPrimario = props.colorPrimario ?? "#111827";
  const stripePromise = loadStripe(props.stripePublishableKey);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  const [habitacionesExtra, setHabitacionesExtra] = useState<HabExtra[]>([]);
  const [mostrarPanel, setMostrarPanel] = useState(false);

  const totalGeneral = props.totalMxn + habitacionesExtra.reduce((s, h) => s + h.totalMxn, 0);
  const isMulti = habitacionesExtra.length > 0;

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paso, setPaso] = useState<"datos" | "pago">("datos");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fmtFecha = (s: string) =>
    new Date(s + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  function agregarHabitacion(hab: HabExtra) {
    setHabitacionesExtra((prev) => [...prev, hab]);
    setMostrarPanel(false);
  }

  function quitarHabitacion(id: string) {
    setHabitacionesExtra((prev) => prev.filter((h) => h.id !== id));
  }

  async function handleDatos(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

    if (isMulti) {
      const habitaciones = [
        {
          tipoDeHabitacionId: props.tipoDeHabitacionId,
          fechaIngreso: props.fechaIngreso,
          fechaSalida: props.fechaSalida,
          numPersonas: props.numPersonas,
        },
        ...habitacionesExtra.map((h) => ({
          tipoDeHabitacionId: h.tipoDeHabitacionId,
          fechaIngreso: h.fechaIngreso,
          fechaSalida: h.fechaSalida,
          numPersonas: h.numPersonas,
        })),
      ];

      const res = await fetch("/api/reservas/checkout-grupo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: props.slug, nombre, email, telefono, habitaciones }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar el pago");
        setCargando(false);
        return;
      }
      window.location.href = data.url;
      return;
    }

    const res = await fetch("/api/reservas/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: props.slug,
        tipoDeHabitacionId: props.tipoDeHabitacionId,
        nombre,
        email,
        telefono,
        fechaIngreso: props.fechaIngreso,
        fechaSalida: props.fechaSalida,
        numPersonas: props.numPersonas,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Error al iniciar el pago");
      setCargando(false);
      return;
    }

    setClientSecret(data.clientSecret);
    setPaso("pago");
    setCargando(false);
  }

  // ── Paso pago (single room) ────────────────────────────────────────────────
  if (paso === "pago" && clientSecret) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">{nombre}</p>
            <p className="text-gray-500 text-xs">{email}</p>
          </div>
          <button
            type="button"
            onClick={() => setPaso("datos")}
            className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-800"
          >
            Editar
          </button>
        </div>
        <Elements stripe={stripePromise} options={{ clientSecret, locale: "es" }}>
          <PagoForm slug={props.slug} totalMxn={props.totalMxn} colorPrimario={colorPrimario} />
        </Elements>
      </div>
    );
  }

  // ── Paso datos ─────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleDatos} className="space-y-5">

      {/* ── Desglose + habitaciones ── */}
      <div className="space-y-2">

        {/* Habitación principal con su desglose */}
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
            <div>
              <p className="text-sm font-semibold text-gray-900">{props.tipoNombre}</p>
              <p className="text-xs text-gray-500">
                {fmtFecha(props.fechaIngreso)} → {fmtFecha(props.fechaSalida)}
                {" · "}{props.numPersonas} persona{props.numPersonas !== 1 ? "s" : ""}
              </p>
            </div>
            <p className="text-sm font-bold text-gray-900">${props.totalMxn.toLocaleString("es-MX")}</p>
          </div>
          {/* Desglose por noche */}
          <div className="px-4 py-3 space-y-1.5 text-xs text-gray-600">
            {props.desglose.map((n) => (
              <div key={n.fecha} className="flex justify-between">
                <span className="text-gray-500">
                  {new Date(n.fecha + "T12:00:00").toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                  {n.temporadaNombre && (
                    <span className="ml-1 text-gray-400">· {n.temporadaNombre}</span>
                  )}
                </span>
                <span>${n.precio.toLocaleString("es-MX")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Habitaciones extra */}
        {habitacionesExtra.map((h) => (
          <div key={h.id} className="flex items-center justify-between rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">{h.tipoNombre}</p>
              <p className="text-xs text-gray-500">
                {fmtFecha(h.fechaIngreso)} → {fmtFecha(h.fechaSalida)}
                {" · "}{h.numPersonas} persona{h.numPersonas !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-bold text-gray-900">${h.totalMxn.toLocaleString("es-MX")}</p>
              <button
                type="button"
                onClick={() => quitarHabitacion(h.id)}
                className="text-gray-400 hover:text-red-500"
                title="Quitar"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}

        {/* Total cuando hay múltiples */}
        {isMulti && (
          <div className="flex justify-between text-sm font-bold text-gray-900 px-1 pt-1 border-t border-gray-200">
            <span>Total {habitacionesExtra.length + 1} habitaciones</span>
            <span>${totalGeneral.toLocaleString("es-MX")} MXN</span>
          </div>
        )}

        {/* Botón / panel agregar */}
        {mostrarPanel ? (
          <AgregarHabitacionPanel
            tipos={props.tipos}
            fechaIngresoPrincipal={props.fechaIngreso}
            fechaSalidaPrincipal={props.fechaSalida}
            colorPrimario={colorPrimario}
            onAgregar={agregarHabitacion}
            onCancelar={() => setMostrarPanel(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setMostrarPanel(true)}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 text-gray-500 py-2.5 text-sm font-medium hover:border-gray-400 hover:text-gray-700 flex items-center justify-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Agregar otra habitación
          </button>
        )}
      </div>

      {/* ── Datos del huésped ── */}
      <div className="border-t border-gray-100 pt-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{ "--tw-ring-color": colorPrimario } as React.CSSProperties}
            placeholder="Tu nombre completo"
            required
            minLength={2}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{ "--tw-ring-color": colorPrimario } as React.CSSProperties}
            placeholder="correo@ejemplo.com"
            required
          />
          <p className="text-xs text-gray-400 mt-1">Aquí recibirás tu código de confirmación.</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="tel"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{ "--tw-ring-color": colorPrimario } as React.CSSProperties}
            placeholder="+52 000 000 0000"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <button
        type="submit"
        disabled={cargando}
        style={{ backgroundColor: colorPrimario }}
        className="w-full rounded-xl text-white py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {cargando
          ? "Un momento..."
          : isMulti
          ? `Pagar $${totalGeneral.toLocaleString("es-MX")} MXN`
          : "Continuar al pago"}
      </button>

      {isMulti ? (
        <p className="text-xs text-gray-400 text-center">
          Serás redirigido a Stripe para completar el pago de {habitacionesExtra.length + 1} habitaciones.
        </p>
      ) : (
        <p className="text-xs text-gray-400 text-center">No necesitas crear una cuenta.</p>
      )}
    </form>
  );
}
