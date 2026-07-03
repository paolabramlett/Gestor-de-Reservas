"use client";

import { useTransition } from "react";

export function SolicitarPagoButton({
  reservaId,
  totalMxn,
  emailHuesped,
  yaTieneLinkActivo,
  solicitarPagoAction,
}: {
  reservaId: string;
  totalMxn: number;
  emailHuesped: string;
  yaTieneLinkActivo: boolean;
  solicitarPagoAction: (id: string) => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    const label = yaTieneLinkActivo
      ? `¿Reenviar link de pago a ${emailHuesped}? El link anterior quedará inválido.`
      : `¿Enviar link de pago de $${totalMxn.toLocaleString("es-MX")} MXN a ${emailHuesped}?`;
    if (!confirm(label)) return;
    startTransition(() => {
      solicitarPagoAction(reservaId);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
    >
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
      </svg>
      {pending ? "Enviando..." : yaTieneLinkActivo ? "Reenviar link de pago" : "Solicitar pago"}
    </button>
  );
}
