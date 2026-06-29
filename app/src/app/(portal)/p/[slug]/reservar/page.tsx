import { getPropiedadBySlug } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { notFound } from "next/navigation";
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

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-2">{tipo.nombre}</h2>
      <p className="text-sm text-gray-500 mb-6">
        {noches} noche{noches !== 1 ? "s" : ""} ·{" "}
        {fechaIn.toLocaleDateString("es-MX")} → {fechaOut.toLocaleDateString("es-MX")} ·{" "}
        {numPersonas} persona{numPersonas !== 1 ? "s" : ""}
      </p>

      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6 text-sm">
        <h3 className="font-medium text-gray-900 mb-2">Desglose de precio</h3>
        {desglose.map((noche) => (
          <div key={noche.fecha} className="flex justify-between text-gray-600 py-0.5">
            <span>{new Date(noche.fecha).toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span>
              ${(noche.modalidad === "POR_PERSONA" ? noche.precio * numPersonas : noche.precio).toLocaleString("es-MX")} MXN
              {noche.fuente === "TEMPORADA" && (
                <span className="ml-1 text-xs text-gray-400">({noche.temporadaNombre})</span>
              )}
            </span>
          </div>
        ))}
        <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold text-gray-900">
          <span>Total</span>
          <span>${total.toLocaleString("es-MX")} MXN</span>
        </div>
      </div>

      <FormularioReserva
        slug={slug}
        tipoDeHabitacionId={tipo.id}
        fechaIngreso={sp.fechaIngreso}
        fechaSalida={sp.fechaSalida}
        numPersonas={numPersonas}
        totalMxn={total}
        stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
      />
    </div>
  );
}
