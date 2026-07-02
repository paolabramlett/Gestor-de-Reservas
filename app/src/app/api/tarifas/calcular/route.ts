import { NextRequest, NextResponse } from "next/server";
import { calcularTotalReserva } from "@/lib/negocio/tarifas";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tipoId = searchParams.get("tipoId");
  const fechaIngresoStr = searchParams.get("fechaIngreso");
  const fechaSalidaStr = searchParams.get("fechaSalida");
  const numPersonas = Number(searchParams.get("numPersonas") ?? 1);

  if (!tipoId || !fechaIngresoStr || !fechaSalidaStr) {
    return NextResponse.json({ error: "Parámetros requeridos" }, { status: 400 });
  }

  const fechaIngreso = new Date(fechaIngresoStr + "T12:00:00");
  const fechaSalida = new Date(fechaSalidaStr + "T12:00:00");

  const { total } = await calcularTotalReserva(tipoId, fechaIngreso, fechaSalida, numPersonas);

  return NextResponse.json({ total: Number(total) });
}
