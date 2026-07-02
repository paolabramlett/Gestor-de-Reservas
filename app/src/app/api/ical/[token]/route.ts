import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function fmtIcal(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function nowStamp(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const mo = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const h = String(now.getUTCHours()).padStart(2, "0");
  const mi = String(now.getUTCMinutes()).padStart(2, "0");
  const s = String(now.getUTCSeconds()).padStart(2, "0");
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function uid(id: string, tipo: string): string {
  return `${tipo}-${id}@roomly.app`;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const tipo = await prisma.tipoDeHabitacion.findUnique({
    where: { icalToken: token },
    include: {
      propiedad: { select: { nombre: true } },
      reservas: {
        where: { estado: { in: ["CONFIRMADA", "EN_CURSO"] } },
        select: { id: true, fechaIngreso: true, fechaSalida: true, nombreHuesped: true },
      },
      bloqueosDeTipo: {
        select: { id: true, fechaInicio: true, fechaFin: true, motivo: true },
      },
    },
  });

  if (!tipo) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const now = nowStamp();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Roomly//Roomly//ES",
    `X-WR-CALNAME:${tipo.propiedad.nombre} - ${tipo.nombre}`,
    "X-WR-TIMEZONE:America/Mexico_City",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const r of tipo.reservas) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid(r.id, "reserva")}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${fmtIcal(r.fechaIngreso)}`,
      `DTEND;VALUE=DATE:${fmtIcal(r.fechaSalida)}`,
      `SUMMARY:${r.nombreHuesped || "Reserva"}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  for (const b of tipo.bloqueosDeTipo) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid(b.id, "bloqueo")}`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${fmtIcal(b.fechaInicio)}`,
      `DTEND;VALUE=DATE:${fmtIcal(addDays(b.fechaFin, 1))}`,
      `SUMMARY:${b.motivo || "No disponible"}`,
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tipo.nombre}.ics"`,
      "Cache-Control": "no-cache, no-store",
    },
  });
}
