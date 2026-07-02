import { prisma } from "@/lib/prisma";
import { getPropiedadBySlug } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AutoRefresh } from "./AutoRefresh";

export default async function ConfirmacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const propiedad = await getPropiedadBySlug(slug);
  if (!propiedad) notFound();

  const colorPrimario = propiedad.colorPrimario ?? "#111827";
  const paymentIntentId = sp.payment_intent;

  // Pago inválido
  if (!paymentIntentId) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <p className="text-gray-500">Enlace de confirmación inválido.</p>
        <Link href={`/p/${slug}`} className="mt-4 inline-block text-sm underline text-gray-700">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const reserva = await prisma.reserva.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: {
      huesped: true,
      tipoDeHabitacion: true,
    },
  });

  // Pago recibido pero webhook aún procesando
  if (!reserva) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <AutoRefresh intervalMs={3000} />
        <div className="max-w-sm w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-amber-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Procesando tu pago</h2>
          <p className="text-sm text-gray-500 mb-6">
            Tu pago fue recibido. Estamos confirmando tu reserva — recibirás un correo en unos momentos.
          </p>
          <Link
            href={`/p/${slug}`}
            className="text-sm underline underline-offset-2 text-gray-500 hover:text-gray-800"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  const noches = Math.round(
    (reserva.fechaSalida.getTime() - reserva.fechaIngreso.getTime()) / 86400000
  );
  const fechaInFmt = reserva.fechaIngreso.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const fechaOutFmt = reserva.fechaSalida.toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-5">

        {/* Encabezado de éxito */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${colorPrimario}18` }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: colorPrimario }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Reserva confirmada!</h1>
          <p className="text-sm text-gray-500">
            Enviamos los detalles a{" "}
            <span className="font-medium text-gray-700">{reserva.huesped.email}</span>
          </p>
        </div>

        {/* Código de reserva */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Código de reserva
          </p>
          <p className="text-3xl font-mono font-bold text-gray-900 tracking-wider mb-1">
            {reserva.codigoReserva}
          </p>
          <p className="text-xs text-gray-400">
            Guarda este código — lo necesitarás para consultar o cancelar tu reserva.
          </p>
        </div>

        {/* Resumen de la estadía */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {reserva.tipoDeHabitacion.fotos?.[0] && (
            <img
              src={(reserva.tipoDeHabitacion as { fotos?: string[] }).fotos?.[0]}
              alt={reserva.tipoDeHabitacion.nombre}
              className="w-full h-36 object-cover"
            />
          )}
          <div className="p-5 space-y-3 text-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-900">{reserva.tipoDeHabitacion.nombre}</p>
                <p className="text-gray-400 text-xs mt-0.5">{noches} noche{noches !== 1 ? "s" : ""}</p>
              </div>
              <p className="font-bold text-gray-900">
                ${Number(reserva.totalMxn).toLocaleString("es-MX")} MXN
              </p>
            </div>
            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Check-in</p>
                <p className="text-gray-800 font-medium text-xs leading-snug">{fechaInFmt}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Check-out</p>
                <p className="text-gray-800 font-medium text-xs leading-snug">{fechaOutFmt}</p>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Huésped</p>
              <p className="text-gray-800 font-medium">{reserva.nombreHuesped || reserva.huesped.nombre}</p>
            </div>
          </div>
        </div>

        {/* CTAs */}
        <div className="space-y-3">
          <Link
            href="/mi-reserva"
            style={{ backgroundColor: colorPrimario }}
            className="w-full flex items-center justify-center gap-2 rounded-xl text-white py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            Consultar mi reserva
          </Link>
          <Link
            href={`/p/${slug}`}
            className="w-full flex items-center justify-center rounded-xl border border-gray-200 text-gray-600 py-3 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Volver al inicio
          </Link>
        </div>

        {/* Nota de contacto */}
        {(propiedad.telefono || propiedad.email) && (
          <div className="text-center text-xs text-gray-400 space-y-0.5">
            <p>¿Tienes dudas? Contáctanos directamente:</p>
            <div className="flex items-center justify-center gap-4">
              {propiedad.telefono && (
                <a href={`tel:${propiedad.telefono}`} className="hover:text-gray-700 transition-colors">
                  {propiedad.telefono}
                </a>
              )}
              {propiedad.email && (
                <a href={`mailto:${propiedad.email}`} className="hover:text-gray-700 transition-colors">
                  {propiedad.email}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
