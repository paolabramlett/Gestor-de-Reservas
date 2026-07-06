type Props = {
  planActivo: string;
  stripeConnectAccountId: string | null;
  stripeConnectHabilitado: boolean;
  iniciarConexionStripeAction: () => Promise<void>;
  abrirDashboardStripeAction: () => Promise<void>;
};

export function PagosSection({
  planActivo,
  stripeConnectAccountId,
  stripeConnectHabilitado,
  iniciarConexionStripeAction,
  abrirDashboardStripeAction,
}: Props) {
  if (planActivo !== "PRO") {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-1">Pagos con tarjeta</h2>
        <p className="text-sm text-gray-500">
          Solicitar pagos con tarjeta y el portal de reservas online son parte del plan Pro.{" "}
          Sube de plan desde la pestaña <strong>Plan</strong> para activar esto.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
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
              className="rounded-lg border border-gray-300 text-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-50"
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
          <form action={iniciarConexionStripeAction}>
            <button
              type="submit"
              className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700"
            >
              {stripeConnectAccountId ? "Continuar configuración" : "Conectar cuenta de Stripe"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
