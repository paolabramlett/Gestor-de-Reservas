import Link from "next/link";
import { marcarLateCheckInDashboardAction, marcarNoShowDashboardAction } from "./actions";

export type ReservaConAlerta = {
  id: string;
  codigo: string;
  nombre: string;
  subtitulo: string;
  etapa: "SIN_LLEGAR" | "SUGERIR_LATE_CHECKIN" | "SUGERIR_NO_SHOW";
};

const CONFIG_ETAPA = {
  SIN_LLEGAR: {
    color: "bg-amber-50 border-amber-200",
    textoColor: "text-amber-800",
    icono: "🟡",
    mensaje: (codigo: string) => `La reserva ${codigo} aún no ha hecho check-in.`,
  },
  SUGERIR_LATE_CHECKIN: {
    color: "bg-orange-50 border-orange-200",
    textoColor: "text-orange-800",
    icono: "🟠",
    mensaje: (codigo: string) => `La reserva ${codigo} lleva retraso. ¿Marcar como Late Check-in?`,
  },
  SUGERIR_NO_SHOW: {
    color: "bg-red-50 border-red-200",
    textoColor: "text-red-800",
    icono: "🔴",
    mensaje: (codigo: string) => `La reserva ${codigo} sigue sin llegar. ¿Marcar como No-Show?`,
  },
} as const;

export function AlertasCheckIn({ reservas }: { reservas: ReservaConAlerta[] }) {
  if (reservas.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {reservas.map((r) => {
        const cfg = CONFIG_ETAPA[r.etapa];
        return (
          <div key={r.id} className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 flex-wrap ${cfg.color}`}>
            <div className="min-w-0">
              <p className={`text-sm font-medium ${cfg.textoColor}`}>
                {cfg.icono} {cfg.mensaje(r.codigo)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{r.nombre} · {r.subtitulo}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/panel/reservas/${r.id}`}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1.5"
              >
                Ver reserva
              </Link>
              {r.etapa === "SUGERIR_LATE_CHECKIN" && (
                <form action={marcarLateCheckInDashboardAction}>
                  <input type="hidden" name="reservaId" value={r.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium bg-orange-600 text-white px-3 py-1.5 rounded-lg hover:bg-orange-700"
                  >
                    Marcar Late Check-in
                  </button>
                </form>
              )}
              {r.etapa === "SUGERIR_NO_SHOW" && (
                <form action={marcarNoShowDashboardAction}>
                  <input type="hidden" name="reservaId" value={r.id} />
                  <button
                    type="submit"
                    className="text-xs font-medium bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700"
                  >
                    Marcar No-Show
                  </button>
                </form>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
