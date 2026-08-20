export type RolLedger = "ADMIN" | "SUPER_ADMIN" | "RESERVACIONES" | "FINANZAS";
export type EstadoLedger = "SIN_PAGOS" | "PAGO_PARCIAL" | "PAGO_COMPLETO";

type PagoStripeVistaInput = {
  id: string;
  cobradoCentavos: number;
  reembolsadoCentavos: number;
  reembolsoPendienteCentavos: number;
  creadoEn: string;
};

export type PagoExternoVistaInput = {
  id: string;
  montoCentavos: number;
  metodo: "EFECTIVO" | "TRANSFERENCIA" | "TERMINAL_EXTERNA" | "OTRO";
  fechaPago: string;
  nota: string | null;
  autor: string;
  estadoComprobante: "NO_SOLICITADO" | "PENDIENTE" | "ENVIADO" | "FALLIDO";
  reemplazaPagoExternoId: string | null;
  ajustes: Array<{
    id: string;
    tipo: "ANULACION" | "REEMBOLSO";
    montoCentavos: number;
    motivo: string;
    autor: string;
    creadoEn: string;
  }>;
};

export type PagoLedgerInput = {
  reservaId: string;
  rol: RolLedger;
  totalReservaCentavos: number;
  pagadoNetoCentavos: number;
  saldoPendienteCentavos: number;
  estado: EstadoLedger;
  pagosStripe: PagoStripeVistaInput[];
  pagosExternos: PagoExternoVistaInput[];
};

const ESTADOS: Record<EstadoLedger, string> = {
  SIN_PAGOS: "Sin pagos",
  PAGO_PARCIAL: "Pago parcial",
  PAGO_COMPLETO: "Pago completo",
};

const METODOS: Record<PagoExternoVistaInput["metodo"], string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TERMINAL_EXTERNA: "Terminal externa",
  OTRO: "Otro",
};

function formatoMxn(centavos: number) {
  return `${new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: centavos % 100 === 0 ? 0 : 2,
  }).format(centavos / 100)} MXN`;
}

export function crearVistaLedger(input: PagoLedgerInput) {
  const puedeMutar = input.rol !== "FINANZAS";
  const movimientosStripe = input.pagosStripe.map((pago) => ({
    id: pago.id,
    fuente: "Stripe" as const,
    monto: formatoMxn(
      Math.max(
        0,
        pago.cobradoCentavos - pago.reembolsadoCentavos - pago.reembolsoPendienteCentavos
      )
    ),
    montoCentavos: Math.max(
      0,
      pago.cobradoCentavos - pago.reembolsadoCentavos - pago.reembolsoPendienteCentavos
    ),
    fecha: pago.creadoEn,
    detalle: "Conciliado automáticamente por Stripe",
    editable: false,
    controles: [] as string[],
  }));
  const movimientosExternos = input.pagosExternos.map((pago) => {
    const ajustadoCentavos = pago.ajustes.reduce(
      (total, ajuste) => total + ajuste.montoCentavos,
      0
    );
    const disponibleCentavos = Math.max(0, pago.montoCentavos - ajustadoCentavos);
    const controles = puedeMutar
      ? [
          ...(disponibleCentavos > 0 ? ["CORREGIR", "ANULAR", "REEMBOLSAR"] : []),
          ...(["FALLIDO", "ENVIADO"].includes(pago.estadoComprobante) ? ["REENVIAR"] : []),
        ]
      : [];
    return {
      id: pago.id,
      fuente: "Pago externo" as const,
      monto: formatoMxn(pago.montoCentavos),
      montoCentavos: pago.montoCentavos,
      disponibleCentavos,
      fecha: pago.fechaPago,
      detalle: METODOS[pago.metodo],
      metodo: pago.metodo,
      autor: pago.autor,
      nota: pago.nota,
      estadoComprobante: pago.estadoComprobante,
      reemplazaPagoExternoId: pago.reemplazaPagoExternoId,
      ajustes: pago.ajustes.map((ajuste) => ({
        ...ajuste,
        monto: formatoMxn(ajuste.montoCentavos),
      })),
      editable: controles.length > 0,
      controles,
    };
  });
  return {
    reservaId: input.reservaId,
    estado: ESTADOS[input.estado],
    total: formatoMxn(input.totalReservaCentavos),
    totalPagado: formatoMxn(input.pagadoNetoCentavos),
    saldoPendiente: formatoMxn(input.saldoPendienteCentavos),
    saldoPendienteCentavos: input.saldoPendienteCentavos,
    puedeRegistrarExterno: puedeMutar && input.saldoPendienteCentavos > 0,
    movimientos: [...movimientosStripe, ...movimientosExternos].sort((a, b) =>
      a.fecha.localeCompare(b.fecha)
    ),
  };
}

const COMPROBANTES: Record<PagoExternoVistaInput["estadoComprobante"], string> = {
  NO_SOLICITADO: "Comprobante no solicitado",
  PENDIENTE: "Comprobante pendiente",
  ENVIADO: "Comprobante enviado",
  FALLIDO: "Falló el comprobante",
};

export function PagoLedger({
  input,
  accionesCabecera,
}: {
  input: PagoLedgerInput;
  accionesCabecera?: ReactNode;
}) {
  const vista = crearVistaLedger(input);
  const badge = vista.estado === "Pago completo"
    ? "bg-green-100 text-green-800"
    : vista.estado === "Pago parcial"
      ? "bg-blue-100 text-blue-800"
      : "bg-amber-100 text-amber-800";

  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5" aria-labelledby="ledger-pagos-titulo">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ledger-pagos-titulo" className="text-sm font-semibold text-gray-700">Pagos</h2>
          <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>{vista.estado}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {accionesCabecera}
          {vista.puedeRegistrarExterno && (
            <PagoExternoDialog reservaId={vista.reservaId} saldoPendienteCentavos={vista.saldoPendienteCentavos} />
          )}
        </div>
      </div>

      <dl className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-gray-50 px-3 py-2"><dt className="text-xs text-gray-500">Total</dt><dd className="mt-1 font-semibold text-gray-900">{vista.total}</dd></div>
        <div className="rounded-lg bg-green-50 px-3 py-2"><dt className="text-xs text-green-700">Pagado neto</dt><dd className="mt-1 font-semibold text-green-900">{vista.totalPagado}</dd></div>
        <div className="rounded-lg bg-amber-50 px-3 py-2"><dt className="text-xs text-amber-700">Saldo pendiente</dt><dd className="mt-1 font-semibold text-amber-900">{vista.saldoPendiente}</dd></div>
      </dl>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Movimientos auditables</h3>
      {vista.movimientos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-500">Aún no hay movimientos de pago.</p>
      ) : (
        <ol className="space-y-3">
          {vista.movimientos.map((movimiento) => (
            <li key={`${movimiento.fuente}-${movimiento.id}`} className="rounded-lg border border-gray-200 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{movimiento.fuente}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{new Date(movimiento.fecha).toLocaleString("es-MX")}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900">{movimiento.monto}</span>
              </div>
              <p className="mt-2 text-sm text-gray-600">{movimiento.detalle}</p>

              {movimiento.fuente === "Pago externo" && (
                <>
                  <dl className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-600 sm:grid-cols-2">
                    <div><dt className="inline font-medium">Registró: </dt><dd className="inline">{movimiento.autor}</dd></div>
                    <div><dt className="inline font-medium">Comprobante: </dt><dd className="inline">{COMPROBANTES[movimiento.estadoComprobante]}</dd></div>
                    {movimiento.reemplazaPagoExternoId && <div className="sm:col-span-2"><dt className="inline font-medium">Corrección de: </dt><dd className="inline font-mono">{movimiento.reemplazaPagoExternoId}</dd></div>}
                    {movimiento.nota && <div className="sm:col-span-2"><dt className="inline font-medium">Nota: </dt><dd className="inline">{movimiento.nota}</dd></div>}
                  </dl>
                  {movimiento.ajustes.length > 0 && (
                    <ul className="mt-3 space-y-2 border-l-2 border-amber-200 pl-3">
                      {movimiento.ajustes.map((ajuste) => (
                        <li key={ajuste.id} className="text-xs text-gray-600">
                          <span className="font-semibold text-amber-800">{ajuste.tipo === "ANULACION" ? "Anulación" : "Reembolso"}: -{ajuste.monto}</span>
                          <span> · {ajuste.motivo} · {ajuste.autor} · {new Date(ajuste.creadoEn).toLocaleString("es-MX")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {movimiento.editable && <AccionesPagoExterno reservaId={vista.reservaId} movimiento={movimiento} />}
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
import type { ReactNode } from "react";
import { AccionesPagoExterno } from "./AccionesPagoExterno";
import { PagoExternoDialog } from "./PagoExternoDialog";
