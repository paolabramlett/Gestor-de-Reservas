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
};

function PagoForm({ slug, totalMxn }: { slug: string; totalMxn: number }) {
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

    if (stripeError) {
      setError(stripeError.message ?? "Error al procesar el pago");
    }
    setCargando(false);
  }

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || cargando}
        className="mt-6 w-full rounded-lg bg-gray-900 text-white py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {cargando ? "Procesando..." : `Pagar $${totalMxn.toLocaleString("es-MX")} MXN`}
      </button>
    </form>
  );
}

export default function FormularioReserva(props: Props) {
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
      <Elements stripe={stripePromise} options={{ clientSecret, locale: "es" }}>
        <PagoForm slug={props.slug} totalMxn={props.totalMxn} />
      </Elements>
    );
  }

  return (
    <form onSubmit={handleDatos} className="space-y-4">
      <h3 className="font-medium text-gray-900">Tus datos</h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo</label>
        <input
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
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
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Teléfono <span className="text-gray-400">(opcional)</span>
        </label>
        <input
          type="tel"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={cargando}
        className="w-full rounded-lg bg-gray-900 text-white py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
      >
        {cargando ? "Preparando pago..." : "Continuar al pago"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        No necesitas crear una cuenta. Recibirás tu código de reserva por correo.
      </p>
    </form>
  );
}
