import { getPropiedadBySlug } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function PagoGrupoRecibidoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const propiedad = await getPropiedadBySlug(slug);
  if (!propiedad) notFound();

  const colorPrimario = propiedad.colorPrimario ?? "#111827";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-5">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${colorPrimario}18` }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: colorPrimario }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">¡Pago recibido!</h1>
          <p className="text-sm text-gray-500">
            Tu pago fue procesado exitosamente. Recibirás una confirmación en tu correo en unos momentos.
          </p>
        </div>

        {(propiedad.telefono || propiedad.email) && (
          <div className="text-center text-xs text-gray-400 space-y-0.5">
            <p>¿Tienes dudas? Contáctanos directamente:</p>
            <div className="flex items-center justify-center gap-4">
              {propiedad.telefono && (
                <a href={`tel:${propiedad.telefono}`} className="hover:text-gray-700 transition-colors">
                  {propiedad.telefono}
                </a>
              )}
              {propiedad.email && (
                <a href={`mailto:${propiedad.email}`} className="hover:text-gray-700 transition-colors">
                  {propiedad.email}
                </a>
              )}
            </div>
          </div>
        )}

        <div className="text-center">
          <Link
            href={`/p/${slug}`}
            className="text-sm underline underline-offset-2 text-gray-500 hover:text-gray-800"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
