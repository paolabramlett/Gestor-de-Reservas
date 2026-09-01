import { StripeConnectEmbedded } from "./StripeConnectEmbedded";

type Props = {
  planActivo: string;
  stripeConnectAccountId: string | null;
  stripeConnectHabilitado: boolean;
  stripePublishableKey: string | null;
  iniciarConexionStripeAction: () => Promise<void>;
  abrirDashboardStripeAction: () => Promise<void>;
};

export function PagosSection({
  planActivo,
  stripeConnectAccountId,
  stripeConnectHabilitado,
  stripePublishableKey,
  iniciarConexionStripeAction,
  abrirDashboardStripeAction,
}: Props) {
  if (planActivo !== "PRO") {
    return (
      <div className="roomly-card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Pagos con tarjeta</h2>
        <p className="text-sm text-gray-500">
          Solicitar pagos con tarjeta y el portal de reservas online son parte del plan Pro.{" "}
          Sube de plan desde la pestaña <strong>Plan</strong> para activar esto.
        </p>
      </div>
    );
  }

  return (
    <div className="roomly-card p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-1">Pagos con tarjeta</h2>
      <p className="text-xs text-gray-400 mb-4">
        El dinero de tus huéspedes va directo a tu propia cuenta de Stripe — Roomly nunca lo recibe
        ni lo retiene. Tú controlas tus datos bancarios y fiscales directamente con Stripe.
      </p>

      {stripeConnectHabilitado ? (
        <div className="space-y-4">
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
            ✓ Tu cuenta de Stripe está conectada y lista para recibir pagos.
          </div>
          <form action={abrirDashboardStripeAction}>
            <button
              type="submit"
              className="rounded-xl border border-slate-300 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Ver mi dashboard de Stripe →
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            {stripeConnectAccountId
              ? "Empezaste tu configuración de pagos pero no la terminaste — no puedes cobrar a huéspedes todavía."
              : "Todavía no conectas tu cuenta de Stripe — no puedes cobrar a huéspedes hasta hacerlo."}
          </div>
          {stripePublishableKey ? (
            <StripeConnectEmbedded publishableKey={stripePublishableKey} />
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              La configuración embebida no está disponible en este momento.
            </div>
          )}
          <div className="border-t border-gray-100 pt-4">
            <p className="mb-2 text-xs text-gray-400">
              Si el formulario embebido no funciona, puedes continuar directamente en Stripe.
            </p>
          <form action={iniciarConexionStripeAction}>
            <button
              type="submit"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-slate-50"
            >
              Abrir formulario alojado de Stripe →
            </button>
          </form>
          </div>
        </div>
      )}
    </div>
  );
}
