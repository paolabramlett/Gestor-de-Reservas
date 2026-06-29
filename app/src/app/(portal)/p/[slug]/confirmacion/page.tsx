import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export default async function ConfirmacionPage({
  searchParams,
}: {
  searchParams: Promise<{ payment_intent?: string }>;
}) {
  const sp = await searchParams;
  const paymentIntentId = sp.payment_intent;

  if (!paymentIntentId) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-500">Página de confirmación inválida.</p>
      </div>
    );
  }

  const reserva = await prisma.reserva.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { huesped: true, tipoDeHabitacion: true },
  });

  if (!reserva) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">⏳</div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Procesando tu reserva</h2>
        <p className="text-gray-500 text-sm">
          Estamos confirmando tu pago. Recibirás un correo en breve con tu código de reserva.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="text-4xl mb-4">✅</div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">¡Reserva confirmada!</h2>
      <p className="text-gray-500 text-sm mb-6">
        Hemos enviado los detalles a <strong>{reserva.huesped.email}</strong>
      </p>
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 text-left">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Código de reserva</p>
        <p className="text-2xl font-mono font-bold text-gray-900 mb-4">{reserva.codigoReserva}</p>
        <div className="text-sm text-gray-600 space-y-1">
          <p><span className="font-medium">Habitación:</span> {reserva.tipoDeHabitacion.nombre}</p>
          <p><span className="font-medium">Llegada:</span> {reserva.fechaIngreso.toLocaleDateString("es-MX")}</p>
          <p><span className="font-medium">Salida:</span> {reserva.fechaSalida.toLocaleDateString("es-MX")}</p>
          <p><span className="font-medium">Total:</span> ${Number(reserva.totalMxn).toLocaleString("es-MX")} MXN</p>
        </div>
      </div>
      <p className="mt-6 text-xs text-gray-400">
        Guarda tu código. Lo necesitarás para consultar o cancelar tu reserva.
      </p>
    </div>
  );
}
