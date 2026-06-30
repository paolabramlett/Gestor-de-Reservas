import { getPropiedadBySlug } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const propiedad = await getPropiedadBySlug(slug);
  if (!propiedad) notFound();

  const colorPrimario = propiedad.colorPrimario ?? "#111827";

  return (
    <div className="min-h-screen flex flex-col" style={{ "--color-primario": colorPrimario } as React.CSSProperties}>
      {/* Header */}
      <header className="bg-[var(--color-primario)] text-white px-6 py-4 flex items-center justify-between">
        <Link href={`/p/${slug}`} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          {propiedad.logoUrl && (
            <img src={propiedad.logoUrl} alt={propiedad.nombre} className="h-8 w-auto" />
          )}
          <span className="font-semibold text-lg">{propiedad.nombre}</span>
        </Link>
        <Link
          href="/mi-reserva"
          className="text-sm font-medium bg-white/15 hover:bg-white/25 px-4 py-1.5 rounded-full transition-colors"
        >
          Mi reserva
        </Link>
      </header>

      {/* Contenido */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-3xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 text-sm text-gray-500">
          <div>
            <p className="font-semibold text-gray-800 mb-1">{propiedad.nombre}</p>
            {propiedad.direccion && <p>{propiedad.direccion}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              {propiedad.telefono && (
                <a href={`tel:${propiedad.telefono}`} className="hover:text-gray-800 transition-colors">
                  {propiedad.telefono}
                </a>
              )}
              {propiedad.email && (
                <a href={`mailto:${propiedad.email}`} className="hover:text-gray-800 transition-colors">
                  {propiedad.email}
                </a>
              )}
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1.5">
            <Link href="/mi-reserva" className="hover:text-gray-800 transition-colors font-medium">
              Consultar mi reserva
            </Link>
            <Link href={`/p/${slug}`} className="hover:text-gray-800 transition-colors">
              Nueva búsqueda
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
