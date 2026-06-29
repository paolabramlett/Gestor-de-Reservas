import { getPropiedadBySlug } from "@/lib/auth";
import { notFound } from "next/navigation";

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

  return (
    <div
      className="min-h-screen"
      style={
        {
          "--color-primario": propiedad.colorPrimario ?? "#111827",
          "--color-secundario": propiedad.colorSecundario ?? "#374151",
        } as React.CSSProperties
      }
    >
      <header className="bg-[var(--color-primario)] text-white px-6 py-4 flex items-center gap-3">
        {propiedad.logoUrl && (
          <img src={propiedad.logoUrl} alt={propiedad.nombre} className="h-8 w-auto" />
        )}
        <span className="font-semibold text-lg">{propiedad.nombre}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
