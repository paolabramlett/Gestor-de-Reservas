import { getCurrentUsuario } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { TipoDeHabitacion, Temporada } from "@prisma/client";

export default async function PanelPage() {
  const usuario = await getCurrentUsuario();
  if (!usuario) redirect("/sign-in");

  // Reservas de hoy
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy);
  manana.setDate(manana.getDate() + 1);

  const [llegadasHoy, salidasHoy, reservasActivas] = await Promise.all([
    prisma.reserva.count({
      where: {
        propiedadId: usuario.propiedadId,
        estado: "CONFIRMADA",
        fechaIngreso: { gte: hoy, lt: manana },
      },
    }),
    prisma.reserva.count({
      where: {
        propiedadId: usuario.propiedadId,
        estado: "EN_CURSO",
        fechaSalida: { gte: hoy, lt: manana },
      },
    }),
    prisma.reserva.count({
      where: {
        propiedadId: usuario.propiedadId,
        estado: { in: ["CONFIRMADA", "EN_CURSO"] },
      },
    }),
  ]);

  // AlertaDeTemporada: fechas sin cobertura en próximos 90 días
  const en90Dias = new Date();
  en90Dias.setDate(en90Dias.getDate() + 90);

  const tipos = await prisma.tipoDeHabitacion.findMany({
    where: { propiedadId: usuario.propiedadId, activo: true },
    include: {
      temporadas: {
        where: { fechaFin: { gte: hoy } },
      },
    },
  });

  const tiposSinCobertura = tipos.filter((tipo: TipoDeHabitacion & { temporadas: Temporada[] }) => {
    const tieneCobertura = tipo.temporadas.some(
      (t: Temporada) => t.fechaInicio <= en90Dias && t.fechaFin >= hoy
    );
    return !tieneCobertura;
  });

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">
        Panel de {usuario.propiedad.nombre}
      </h1>

      {tiposSinCobertura.length > 0 && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
          <p className="text-sm font-medium text-amber-800">
            ⚠️ Atención: {tiposSinCobertura.length} tipo(s) de habitación sin temporada
            configurada en los próximos 90 días:{" "}
            {tiposSinCobertura.map((t) => t.nombre).join(", ")}. Los clientes
            verán precios de TarifaBase.{" "}
            <a href="/panel/temporadas" className="underline font-semibold">
              Configurar temporadas
            </a>
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Llegadas hoy</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{llegadasHoy}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Salidas hoy</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{salidasHoy}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-500">Reservas activas</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{reservasActivas}</p>
        </div>
      </div>

      <div className="flex gap-4">
        <a
          href="/panel/reservas"
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700"
        >
          Ver reservas
        </a>
        <a
          href="/panel/reservas/nueva"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Nueva reserva manual
        </a>
      </div>
    </main>
  );
}
