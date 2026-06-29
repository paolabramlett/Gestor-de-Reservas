import { NextRequest, NextResponse } from "next/server";
import { buscarDisponibilidad } from "@/lib/negocio/disponibilidad";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";
import { getPropiedadBySlug } from "@/lib/auth";
import { z } from "zod";

const querySchema = z.object({
  slug: z.string(),
  fechaIngreso: z.string().date(),
  fechaSalida: z.string().date(),
  numPersonas: z.coerce.number().int().min(1).max(20),
});

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams);
  const result = querySchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const { slug, fechaIngreso, fechaSalida, numPersonas } = result.data;

  const fechaIn = new Date(fechaIngreso);
  const fechaOut = new Date(fechaSalida);

  if (fechaIn >= fechaOut) {
    return NextResponse.json(
      { error: "La fecha de salida debe ser posterior a la de ingreso" },
      { status: 400 }
    );
  }

  const propiedad = await getPropiedadBySlug(slug);
  if (!propiedad) {
    return NextResponse.json({ error: "Propiedad no encontrada" }, { status: 404 });
  }

  const tipos = await buscarDisponibilidad(propiedad.id, fechaIn, fechaOut, numPersonas);

  const resultados = await Promise.all(
    tipos.map(async (tipo) => {
      const { total, desglose } = await calcularTotalReserva(
        tipo.tipoDeHabitacionId,
        fechaIn,
        fechaOut,
        numPersonas
      );
      return { ...tipo, totalMxn: total, desglosePorNoche: desglose };
    })
  );

  return NextResponse.json({ propiedad: { nombre: propiedad.nombre, slug: propiedad.slug }, resultados });
}
