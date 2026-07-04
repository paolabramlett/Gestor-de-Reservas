import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export default async function GruposPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const grupos = await prisma.grupoReserva.findMany({
    where: { propiedadId: usuario.propiedadId },
    include: {
      reservas: {
        include: { tipoDeHabitacion: true, huesped: true },
        orderBy: { fechaIngreso: "asc" },
      },
    },
    orderBy: { creadoEn: "desc" },
  });

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Reservas grupales</h1>
        <Link
          href="/panel/grupos/nuevo"
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700 whitespace-nowrap"
        >
          + Nueva reserva grupal
        </Link>
      </div>

      {grupos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
          </div>
          <p className="text-gray-500 font-medium mb-1">Sin reservas grupales todavía</p>
          <p className="text-sm text-gray-400 mb-4">Crea una reserva grupal para familias o grupos que ocupen varias habitaciones bajo un mismo código.</p>
          <Link href="/panel/grupos/nuevo" className="inline-flex rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
            + Nueva reserva grupal
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const totalGeneral = g.reservas.reduce((s, r) => s + Number(r.totalMxn), 0);
            const fechaMin = g.reservas.length
              ? g.reservas.reduce((min, r) => r.fechaIngreso < min ? r.fechaIngreso : min, g.reservas[0].fechaIngreso)
              : null;
            const fechaMax = g.reservas.length
              ? g.reservas.reduce((max, r) => r.fechaSalida > max ? r.fechaSalida : max, g.reservas[0].fechaSalida)
              : null;

            return (
              <Link
                key={g.id}
                href={`/panel/grupos/${g.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">Cód. reserva</span>
                      <span className="font-mono text-xs font-semibold text-gray-700">{g.codigoGrupo}</span>
                    </div>
                    <h2 className="text-base font-semibold text-gray-900 truncate">{g.nombre}</h2>
                    {g.notas && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{g.notas}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-gray-900">${totalGeneral.toLocaleString("es-MX")} MXN</p>
                    <p className="text-xs text-gray-400">{g.reservas.length} habitación{g.reservas.length !== 1 ? "es" : ""}</p>
                  </div>
                </div>

                {g.reservas.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {g.reservas.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                        <span className="font-medium text-gray-700">{r.tipoDeHabitacion.nombre}</span>
                        <span className="text-gray-400">·</span>
                        <span className="text-gray-500">{r.nombreHuesped || r.huesped.nombre}</span>
                      </span>
                    ))}
                  </div>
                )}

                {fechaMin && fechaMax && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    {new Date(fechaMin).toLocaleDateString("es-MX", { day: "numeric", month: "short", timeZone: "UTC" })}
                    {" → "}
                    {new Date(fechaMax).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
