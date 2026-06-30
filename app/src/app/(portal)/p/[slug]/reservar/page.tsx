import { getPropiedadBySlug } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { notFound } from "next/navigation";
import Link from "next/link";
import FormularioReserva from "./FormularioReserva";

export default async function ReservarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    tipoId?: string;
    fechaIngreso?: string;
    fechaSalida?: string;
    numPersonas?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  if (!sp.tipoId || !sp.fechaIngreso || !sp.fechaSalida) notFound();

  const propiedad = await getPropiedadBySlug(slug);
  if (!propiedad) notFound();

  const tipo = await prisma.tipoDeHabitacion.findFirst({
    where: { id: sp.tipoId, propiedadId: propiedad.id, activo: true },
  });
  if (!tipo) notFound();

  const fechaIn = new Date(sp.fechaIngreso);
  const fechaOut = new Date(sp.fechaSalida);
  const numPersonas = Number(sp.numPersonas ?? 2);

  const { total, desglose } = await calcularTotalReserva(tipo.id, fechaIn, fechaOut, numPersonas);
  const noches = desglose.length;
  const colorPrimario = propiedad.colorPrimario ?? "#111827";

  const fechaInFmt = fechaIn.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const fechaOutFmt = fechaOut.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <Link
          href={`/p/${slug}/buscar?tipoId=${sp.tipoId}&fechaIngreso=${sp.fechaIngreso}&fechaSalida=${sp.fechaSalida}&numPersonas=${numPersonas}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Volver a resultados
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          {/* ── Columna izquierda: resumen de la habitación ── */}
          <div className="lg:col-span-2 space-y-4">
            {/* Card habitación */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              {tipo.fotos[0] ? (
                <img
                  src={tipo.fotos[0]}
                  alt={tipo.nombre}
                  className="w-full h-44 object-cover"
                />
              ) : (
                <div className="w-full h-44 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                  </svg>
                </div>
              )}
              <div className="p-4">
                <h2 className="font-bold text-gray-900 text-lg mb-1">{tipo.nombre}</h2>
                {tipo.descripcion && (
                  <p className="text-sm text-gray-500 mb-3">{tipo.descripcion}</p>
                )}
                {tipo.amenidades.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tipo.amenidades.slice(0, 4).map((a) => (
                      <span key={a} className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5">{a}</span>
                    ))}
                    {tipo.amenidades.length > 4 && (
                      <span className="text-xs text-gray-400 py-0.5">+{tipo.amenidades.length - 4} más</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Resumen de fechas */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm text-sm space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Check-in</p>
                  <p className="font-medium text-gray-900">{fechaInFmt}</p>
                </div>
                <svg className="w-4 h-4 text-gray-300 mt-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Check-out</p>
                  <p className="font-medium text-gray-900">{fechaOutFmt}</p>
                </div>
              </div>
              <div className="flex justify-between text-gray-500 pt-2 border-t border-gray-100">
                <span>{noches} noche{noches !== 1 ? "s" : ""}</span>
                <span>{numPersonas} persona{numPersonas !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Desglose de precio */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm text-sm">
              <p className="font-semibold text-gray-800 mb-3">Desglose de precio</p>
              <div className="space-y-1.5">
                {desglose.map((noche) => (
                  <div key={noche.fecha} className="flex justify-between text-gray-600">
                    <span className="text-gray-500">
                      {new Date(noche.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}
                      {noche.fuente === "TEMPORADA" && (
                        <span className="ml-1 text-xs text-gray-400">· {noche.temporadaNombre}</span>
                      )}
                    </span>
                    <span>
                      ${(noche.modalidad === "POR_PERSONA" ? noche.precio * numPersonas : noche.precio).toLocaleString("es-MX")}
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span>${total.toLocaleString("es-MX")} MXN</span>
              </div>
            </div>
          </div>

          {/* ── Columna derecha: formulario de datos y pago ── */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h1 className="text-xl font-bold text-gray-900 mb-1">Completa tu reserva</h1>
              <p className="text-sm text-gray-500 mb-6">
                Recibirás un código de confirmación en tu correo electrónico.
              </p>
              <FormularioReserva
                slug={slug}
                tipoDeHabitacionId={tipo.id}
                fechaIngreso={sp.fechaIngreso}
                fechaSalida={sp.fechaSalida}
                numPersonas={numPersonas}
                totalMxn={total}
                stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
                colorPrimario={colorPrimario}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
