import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function CambioPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ accion?: string }>;
}) {
  const { token } = await params;
  const { accion } = await searchParams;

  const solicitud = await prisma.solicitudCambio.findUnique({
    where: { token },
    include: {
      reserva: { include: { propiedad: true, huesped: true } },
    },
  });

  if (!solicitud) notFound();

  const { reserva } = solicitud;
  const colorPrimario = reserva.propiedad.colorPrimario ?? "#111827";
  const diferencia = Number(solicitud.diferencia);
  const esCobro = diferencia > 0;
  const expirada = new Date() > solicitud.expiresAt;
  const estado = expirada && solicitud.estado === "PENDIENTE" ? "EXPIRADA" : solicitud.estado;

  function fmt(d: Date) {
    return new Date(d).toLocaleDateString("es-MX", {
      day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
    });
  }

  void accion; // ignorado — requiere acción explícita del usuario

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        {/* Header hotel */}
        <div className="rounded-2xl text-white text-center py-8 px-6 mb-6" style={{ backgroundColor: colorPrimario }}>
          <p className="text-sm font-semibold uppercase tracking-widest opacity-75 mb-1">{reserva.propiedad.nombre}</p>
          <h1 className="text-2xl font-bold">Propuesta de cambio</h1>
          <p className="text-sm opacity-75 mt-1">Reserva {reserva.codigoReserva}</p>
        </div>

        {estado !== "PENDIENTE" ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center shadow-sm">
            {estado === "ACEPTADA" && (
              <>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Cambio aceptado</h2>
                <p className="text-gray-500 text-sm">Tu reserva ha sido actualizada. Recibirás una confirmación por correo.</p>
              </>
            )}
            {estado === "RECHAZADA" && (
              <>
                <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Cambio rechazado</h2>
                <p className="text-gray-500 text-sm">Tu reserva original permanece sin cambios.</p>
              </>
            )}
            {(estado === "EXPIRADA" || estado === "CANCELADA") && (
              <>
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Propuesta expirada</h2>
                <p className="text-gray-500 text-sm">Esta propuesta ya no está activa. Tu reserva original permanece sin cambios.</p>
              </>
            )}
          </div>
        ) : (
          <CambioForm
            token={token}
            solicitud={{
              fechaIngresoActual: fmt(reserva.fechaIngreso),
              fechaSalidaActual: fmt(reserva.fechaSalida),
              fechaIngresoNueva: fmt(solicitud.fechaIngresoNueva),
              fechaSalidaNueva: fmt(solicitud.fechaSalidaNueva),
              totalActual: Number(solicitud.totalActual),
              totalNuevo: Number(solicitud.totalNuevo),
              diferencia,
              esCobro,
              expiresAt: fmt(solicitud.expiresAt),
            }}
            colorPrimario={colorPrimario}
          />
        )}
      </div>
    </div>
  );
}

// Client component for interactivity
import CambioForm from "./CambioForm";
