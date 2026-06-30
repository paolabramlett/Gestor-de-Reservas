"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

type Props = {
  slug: string;
  tipoDeHabitacionId: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  totalMxn: number;
  stripePublishableKey: string;
  colorPrimario?: string;
};

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
      confirmParams: {
        return_url: `${window.location.origin}/p/${slug}/confirmacion`,
      },
    });

    if (stripeError) setError(stripeError.message ?? "Error al procesar el pago");
    setCargando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
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
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        Pago seguro procesado por Stripe
      </div>
    </form>
  );
}

export default function FormularioReserva(props: Props) {
  const colorPrimario = props.colorPrimario ?? "#111827";
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [paso, setPaso] = useState<"datos" | "pago">("datos");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stripePromise = loadStripe(props.stripePublishableKey);

  async function handleDatos(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);

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

  if (paso === "pago" && clientSecret) {
    return (
      <div className="space-y-5">
        {/* Mini resumen del huésped */}
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

  return (
    <form onSubmit={handleDatos} className="space-y-4">
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

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={cargando}
        style={{ backgroundColor: colorPrimario }}
        className="w-full rounded-xl text-white py-3.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
      >
        {cargando ? "Un momento..." : "Continuar al pago"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        No necesitas crear una cuenta.
      </p>
    </form>
  );
}
