import { requireFinanzas } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EstadoDePago } from "@prisma/client";
import Link from "next/link";
import { DatePicker } from "@/components/DatePicker";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function periodoDefecto() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return {
    inicio: inicio.toISOString().slice(0, 10),
    fin: fin.toISOString().slice(0, 10),
  };
}

export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    inicio?: string;
    fin?: string;
    estado?: string;
    tipo?: string;
    origen?: string;
    pago?: string;
  }>;
}) {
  const usuario = await requireFinanzas();

  const sp = await searchParams;
  const def = periodoDefecto();
  const inicio = sp.inicio ?? def.inicio;
  const fin = sp.fin ?? def.fin;
  const fechaInicio = new Date(inicio);
  const fechaFin = new Date(fin + "T23:59:59");

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId },
    orderBy: { nombre: "asc" },
  });

  // Filtros de la lista (12.3 + 12.4)
  const filtrosReserva: Record<string, unknown> = {
    propiedadId: usuario.propiedadId,
    creadoEn: { gte: fechaInicio, lte: fechaFin },
  };
  if (sp.estado) filtrosReserva.estado = sp.estado;
  if (sp.tipo) filtrosReserva.tipoDeHabitacionId = sp.tipo;
  if (sp.origen) filtrosReserva.origen = sp.origen;

  const reservas = await prisma.reserva.findMany({
    where: {
      ...filtrosReserva,
      ...(sp.pago
        ? { pagoManual: { estadoDePago: sp.pago as EstadoDePago } }
        : {}),
    },
    include: {
      huesped: true,
      tipoDeHabitacion: true,
      pagoManual: true,
    },
    orderBy: { creadoEn: "desc" },
  });

  // ── Métricas para el período (12.1 + 12.2) — query independiente sin filtros UI ──
  const todasReservasPeriodo = await prisma.reserva.findMany({
    where: {
      propiedadId: usuario.propiedadId,
      creadoEn: { gte: fechaInicio, lte: fechaFin },
      estado: { in: ["CONFIRMADA", "EN_CURSO", "COMPLETADA"] },
    },
    select: { totalMxn: true, origen: true, tipoDeHabitacionId: true },
  });

  const totalIngresos = todasReservasPeriodo.reduce((s, r) => s + Number(r.totalMxn), 0);
  const totalOnline = todasReservasPeriodo.filter((r) => r.origen === "ONLINE").reduce((s, r) => s + Number(r.totalMxn), 0);
  const totalManual = todasReservasPeriodo.filter((r) => r.origen === "MANUAL").reduce((s, r) => s + Number(r.totalMxn), 0);

  // alias para métricas de tipo que necesitan el array completo
  const reservasActivas = todasReservasPeriodo;

  // Tasa de ocupación por tipo (12.1)
  const diasPeriodo = Math.max(
    1,
    Math.round((fechaFin.getTime() - fechaInicio.getTime()) / 86400000)
  );

  const ocupacionPorTipo = await Promise.all(
    tipos.map(async (t) => {
      const habitaciones = await prisma.habitacion.count({
        where: { propiedadId: usuario.propiedadId, tipoDeHabitacionId: t.id, activa: true },
      });
      const noches = await prisma.reserva.findMany({
        where: {
          propiedadId: usuario.propiedadId,
          tipoDeHabitacionId: t.id,
          estado: { in: ["CONFIRMADA", "EN_CURSO", "COMPLETADA"] },
          fechaIngreso: { lte: fechaFin },
          fechaSalida: { gte: fechaInicio },
        },
        select: { fechaIngreso: true, fechaSalida: true },
      });
      const nochesOcupadas = noches.reduce((sum, r) => {
        const s = Math.max(fechaInicio.getTime(), new Date(r.fechaIngreso).getTime());
        const e = Math.min(fechaFin.getTime(), new Date(r.fechaSalida).getTime());
        return sum + Math.max(0, Math.round((e - s) / 86400000));
      }, 0);
      const capacidadTotal = habitaciones * diasPeriodo;
      const tasa = capacidadTotal > 0 ? Math.round((nochesOcupadas / capacidadTotal) * 100) : 0;
      return { tipo: t.nombre, tasa, habitaciones, nochesOcupadas, capacidadTotal };
    })
  );

  // Ingresos por tipo (12.2)
  const ingresosPorTipo = tipos.map((t) => ({
    tipo: t.nombre,
    online: reservasActivas
      .filter((r) => r.tipoDeHabitacionId === t.id && r.origen === "ONLINE")
      .reduce((s, r) => s + Number(r.totalMxn), 0),
    manual: reservasActivas
      .filter((r) => r.tipoDeHabitacionId === t.id && r.origen === "MANUAL")
      .reduce((s, r) => s + Number(r.totalMxn), 0),
  })).filter((r) => r.online + r.manual > 0);

  const ESTADO_LABEL: Record<string, string> = {
    CONFIRMADA: "Confirmada",
    EN_CURSO: "En curso",
    COMPLETADA: "Completada",
    CANCELADA: "Cancelada",
    NO_SHOW: "No-Show",
  };
  const ESTADO_COLOR: Record<string, string> = {
    CONFIRMADA: "bg-blue-100 text-blue-800",
    EN_CURSO: "bg-green-100 text-green-800",
    COMPLETADA: "bg-gray-100 text-gray-600",
    CANCELADA: "bg-red-100 text-red-700",
    NO_SHOW: "bg-orange-100 text-orange-800",
  };

  const buildUrl = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ inicio, fin, ...sp, ...extra });
    return `/panel/reportes?${p.toString()}`;
  };

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Reportes</h1>

      {/* Selector de período */}
      <form method="GET" className="flex flex-wrap gap-3 items-end mb-8 bg-white border border-gray-200 rounded-lg p-4">
        <div className="w-44">
          <label className="block text-xs text-gray-500 mb-1">Desde</label>
          <DatePicker name="inicio" defaultValue={inicio} />
        </div>
        <div className="w-44">
          <label className="block text-xs text-gray-500 mb-1">Hasta</label>
          <DatePicker name="fin" defaultValue={fin} />
        </div>
        {/* Accesos rápidos */}
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Este mes", ...def },
            { label: "Mes anterior", ...mesAnterior() },
            { label: "Últimos 90d", ...ultimos90() },
          ].map((p) => (
            <Link
              key={p.label}
              href={buildUrl({ inicio: p.inicio, fin: p.fin })}
              className="px-3 py-2 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              {p.label}
            </Link>
          ))}
        </div>
        <button type="submit" className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
          Aplicar
        </button>
      </form>

      {/* ── Métricas principales (12.2) ── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricCard label="Ingresos totales" value={`$${totalIngresos.toLocaleString("es-MX")} MXN`} sub={`${reservasActivas.length} reservas`} />
        <MetricCard label="Online (Stripe)" value={`$${totalOnline.toLocaleString("es-MX")} MXN`} sub={`${reservasActivas.filter((r) => r.origen === "ONLINE").length} reservas`} />
        <MetricCard label="Manual" value={`$${totalManual.toLocaleString("es-MX")} MXN`} sub={`${reservasActivas.filter((r) => r.origen === "MANUAL").length} reservas`} />
      </div>

      {/* ── Ocupación por tipo (12.1) ── */}
      {ocupacionPorTipo.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Tasa de ocupación por tipo</h2>
          <div className="space-y-3">
            {ocupacionPorTipo.map((o) => (
              <div key={o.tipo}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{o.tipo}</span>
                  <span className="font-medium text-gray-900">{o.tasa}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-gray-800 h-2 rounded-full"
                    style={{ width: `${o.tasa}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {o.nochesOcupadas} noches ocupadas de {o.capacidadTotal} disponibles ({o.habitaciones} hab. × {diasPeriodo} días)
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ingresos por tipo (12.2) ── */}
      {ingresosPorTipo.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Ingresos por tipo de habitación</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left pb-2 text-gray-500 font-medium">Tipo</th>
                <th className="text-right pb-2 text-gray-500 font-medium">Online</th>
                <th className="text-right pb-2 text-gray-500 font-medium">Manual</th>
                <th className="text-right pb-2 text-gray-500 font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {ingresosPorTipo.map((r) => (
                <tr key={r.tipo}>
                  <td className="py-2 text-gray-700">{r.tipo}</td>
                  <td className="py-2 text-right text-gray-600">${r.online.toLocaleString("es-MX")}</td>
                  <td className="py-2 text-right text-gray-600">${r.manual.toLocaleString("es-MX")}</td>
                  <td className="py-2 text-right font-medium text-gray-900">${(r.online + r.manual).toLocaleString("es-MX")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Lista de reservas con filtros (12.3 + 12.4) ── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700 mr-2">Filtros:</span>

          {/* Estado */}
          {["", "CONFIRMADA", "EN_CURSO", "COMPLETADA", "CANCELADA"].map((e) => (
            <Link
              key={e}
              href={buildUrl({ estado: e })}
              className={`px-2 py-1 rounded text-xs font-medium ${(sp.estado ?? "") === e ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {e ? ESTADO_LABEL[e] : "Todos"}
            </Link>
          ))}

          <span className="text-gray-300 mx-1">|</span>

          {/* Origen */}
          {[["", "Todos"], ["ONLINE", "Online"], ["MANUAL", "Manual"]].map(([v, l]) => (
            <Link
              key={v}
              href={buildUrl({ origen: v })}
              className={`px-2 py-1 rounded text-xs font-medium ${(sp.origen ?? "") === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {l}
            </Link>
          ))}

          <span className="text-gray-300 mx-1">|</span>

          {/* EstadoDePago (12.4) */}
          {[["", "Cualquier pago"], ["PENDIENTE", "Pago pendiente"], ["ANTICIPO_PAGADO", "Anticipo"], ["PAGADO_COMPLETO", "Pagado"]].map(([v, l]) => (
            <Link
              key={v}
              href={buildUrl({ pago: v })}
              className={`px-2 py-1 rounded text-xs font-medium ${(sp.pago ?? "") === v ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            >
              {l}
            </Link>
          ))}
        </div>

        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Huésped</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Ingreso</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {reservas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  Sin reservas para el período y filtros seleccionados
                </td>
              </tr>
            )}
            {reservas.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/panel/reservas/${r.id}`} className="font-mono text-blue-600 hover:underline text-xs">
                    {r.codigoReserva}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">{r.nombreHuesped || r.huesped.nombre}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{r.tipoDeHabitacion.nombre}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(r.fechaIngreso).toLocaleDateString("es-MX")}</td>
                <td className="px-4 py-3 text-gray-700">${Number(r.totalMxn).toLocaleString("es-MX")}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLOR[r.estado]}`}>
                    {ESTADO_LABEL[r.estado]}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {r.pagoManual ? r.pagoManual.estadoDePago.replace(/_/g, " ") : "Stripe"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {reservas.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {reservas.length} reservas · Total mostrado: ${reservas.reduce((s, r) => s + Number(r.totalMxn), 0).toLocaleString("es-MX")} MXN
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

function mesAnterior() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  return { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
}

function ultimos90() {
  const fin = new Date();
  const inicio = new Date(fin.getTime() - 90 * 86400000);
  return { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) };
}
