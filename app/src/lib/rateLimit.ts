import { NextRequest } from "next/server";

// Rate limiter en memoria por instancia (sliding window).
// En Vercel cada lambda tiene su propia memoria, así que el límite efectivo
// es aproximado — suficiente para frenar abuso básico en el piloto.
const ventanas = new Map<string, number[]>();

const MAX_ENTRADAS = 5000;

export function rateLimit(
  req: NextRequest,
  { limite, ventanaMs }: { limite: number; ventanaMs: number }
): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "desconocida";

  const ahora = Date.now();
  const marca = `${ip}`;
  const previas = (ventanas.get(marca) ?? []).filter((t) => ahora - t < ventanaMs);

  if (previas.length >= limite) {
    ventanas.set(marca, previas);
    return false;
  }

  previas.push(ahora);
  ventanas.set(marca, previas);

  // Evitar crecimiento sin límite de memoria
  if (ventanas.size > MAX_ENTRADAS) {
    const cutoff = ahora - ventanaMs;
    for (const [k, v] of ventanas) {
      if (v.every((t) => t < cutoff)) ventanas.delete(k);
    }
  }

  return true;
}
