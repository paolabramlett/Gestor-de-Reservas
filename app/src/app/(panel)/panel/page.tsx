import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import type { TipoDeHabitacion, Temporada } from "@prisma/client";

export default async function PanelPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);
  const en7dias = new Date(hoy);
  en7dias.setDate(en7dias.getDate() + 7);
  const en90dias = new Date(hoy);
  en90dias.setDate(en90dias.getDate() + 90);

  const [llegadasHoy, salidasHoy, enCurso, proximasLlegadas, tipos] = await Promise.all([
    prisma.reserva.findMany({
      where: {
        propiedadId: usuario.propiedadId,
        estado: "CONFIRMADA",
        fechaIngreso: { gte: hoy, lt: manana },
      },
      include: {
        huesped: true,
        tipoDeHabitacion: true,
        asignacion: { include: { habitacion: true } },
      },
      orderBy: { fechaIngreso: "asc" },
    }),
    prisma.reserva.findMany({
      where: {
        propiedadId: usuario.propiedadId,
        estado: "EN_CURSO",
        fechaSalida: { gte: hoy, lt: manana },
      },
      include: {
        huesped: true,
        tipoDeHabitacion: true,
        asignacion: { include: { habitacion: true } },
      },
      orderBy: { fechaSalida: "asc" },
    }),
    prisma.reserva.findMany({
      where: {
        propiedadId: usuario.propiedadId,
        estado: "EN_CURSO",
      },
      include: {
        huesped: true,
        tipoDeHabitacion: true,
        asignacion: { include: { habitacion: true } },
      },
      orderBy: { fechaSalida: "asc" },
    }),
    prisma.reserva.findMany({
      where: {
        propiedadId: usuario.propiedadId,
        estado: "CONFIRMADA",
        fechaIngreso: { gte: manana, lt: en7dias },
      },
      include: { huesped: true, tipoDeHabitacion: true },
      orderBy: { fechaIngreso: "asc" },
    }),
    prisma.tipoDeHabitacion.findMany({
      where: { propiedadId: usuario.propiedadId, activo: true },
      include: { temporadas: { where: { fechaFin: { gte: hoy } } } },
    }),
  ]);

  const tiposSinCobertura = tipos.filter((tipo: TipoDeHabitacion & { temporadas: Temporada[] }) =>
    !tipo.temporadas.some((t: Temporada) => t.fechaInicio <= en90dias && t.fechaFin >= hoy)
  );

  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" });

  return (
    <main className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {hoy.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}
        </h1>
        <Link
          href="/panel/reservas/nueva"
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700"
        >
          + Nueva reserva
        </Link>
      </div>

      {tiposSinCobertura.length > 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          ⚠️ {tiposSinCobertura.length} tipo{tiposSinCobertura.length > 1 ? "s" : ""} sin temporada en los próximos 90 días:{" "}
          <span className="font-medium">{tiposSinCobertura.map((t) => t.nombre).join(", ")}</span>.{" "}
          <Link href="/panel/temporadas" className="underline font-semibold">Configurar temporadas</Link>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Llegadas hoy</p>
          <p className="text-3xl font-bold text-gray-900">{llegadasHoy.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">En casa</p>
          <p className="text-3xl font-bold text-gray-900">{enCurso.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Salidas hoy</p>
          <p className="text-3xl font-bold text-gray-900">{salidasHoy.length}</p>
        </div>
      </div>

      {/* Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section
          title="Llegadas de hoy"
          empty="Sin llegadas programadas para hoy."
          action={{ href: "/panel/calendario", label: "Ver calendario" }}
        >
          {llegadasHoy.map((r) => (
            <ReservaRow
              key={r.id}
              id={r.id}
              codigo={r.codigoReserva}
              nombre={r.huesped.nombre}
              subtitulo={`${r.tipoDeHabitacion.nombre}${r.asignacion ? ` · Hab. ${r.asignacion.habitacion.numero}` : ""} · ${r.numPersonas} pax`}
              badge={!r.asignacion ? { text: "Sin hab.", color: "amber" } : undefined}
            />
          ))}
        </Section>

        <Section title="Salidas de hoy" empty="Sin salidas programadas para hoy.">
          {salidasHoy.map((r) => (
            <ReservaRow
              key={r.id}
              id={r.id}
              codigo={r.codigoReserva}
              nombre={r.huesped.nombre}
              subtitulo={`${r.tipoDeHabitacion.nombre}${r.asignacion ? ` · Hab. ${r.asignacion.habitacion.numero}` : ""}`}
            />
          ))}
        </Section>

        <Section title="Huéspedes en casa" empty="No hay huéspedes en casa actualmente.">
          {enCurso.map((r) => (
            <ReservaRow
              key={r.id}
              id={r.id}
              codigo={r.codigoReserva}
              nombre={r.huesped.nombre}
              subtitulo={`${r.tipoDeHabitacion.nombre}${r.asignacion ? ` · Hab. ${r.asignacion.habitacion.numero}` : ""} · Sale ${fmt(r.fechaSalida)}`}
            />
          ))}
        </Section>

        <Section title="Próximos 7 días" empty="Sin reservas confirmadas esta semana.">
          {proximasLlegadas.map((r) => (
            <ReservaRow
              key={r.id}
              id={r.id}
              codigo={r.codigoReserva}
              nombre={r.huesped.nombre}
              subtitulo={`${r.tipoDeHabitacion.nombre} · Llega ${fmt(r.fechaIngreso)}`}
            />
          ))}
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  empty,
  action,
  children,
}: {
  title: string;
  empty: string;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
        {action && (
          <Link href={action.href} className="text-xs text-gray-400 hover:text-gray-700">
            {action.label} →
          </Link>
        )}
      </div>
      {arr.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-50">{children}</ul>
      )}
    </div>
  );
}

function ReservaRow({
  id,
  codigo,
  nombre,
  subtitulo,
  badge,
}: {
  id: string;
  codigo: string;
  nombre: string;
  subtitulo: string;
  badge?: { text: string; color: "amber" | "red" };
}) {
  const badgeClass =
    badge?.color === "amber" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

  return (
    <li>
      <Link
        href={`/panel/reservas/${id}`}
        className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm truncate">{nombre}</span>
            {badge && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full shrink-0 ${badgeClass}`}>
                {badge.text}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitulo}</p>
        </div>
        <span className="text-xs font-mono text-gray-400 ml-4 shrink-0">{codigo}</span>
      </Link>
    </li>
  );
}
