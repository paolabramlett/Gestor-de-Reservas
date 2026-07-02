import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

type IcalEvent = {
  fechaInicio: Date;
  fechaFin: Date;
  motivo: string;
};

function parseIcalDate(val: string): Date | null {
  // DATE format: 20240115
  if (/^\d{8}$/.test(val)) {
    const y = parseInt(val.slice(0, 4));
    const m = parseInt(val.slice(4, 6)) - 1;
    const d = parseInt(val.slice(6, 8));
    return new Date(Date.UTC(y, m, d));
  }
  // DATETIME format: 20240115T120000Z or 20240115T120000
  if (/^\d{8}T\d{6}Z?$/.test(val)) {
    const y = parseInt(val.slice(0, 4));
    const m = parseInt(val.slice(4, 6)) - 1;
    const d = parseInt(val.slice(6, 8));
    return new Date(Date.UTC(y, m, d));
  }
  return null;
}

function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  const lines = text.replace(/\r\n[ \t]/g, "").split(/\r?\n/);

  let inEvent = false;
  let dtstart: string | null = null;
  let dtend: string | null = null;
  let summary: string | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      dtstart = null;
      dtend = null;
      summary = null;
      continue;
    }
    if (line === "END:VEVENT") {
      inEvent = false;
      if (dtstart && dtend) {
        const start = parseIcalDate(dtstart);
        const end = parseIcalDate(dtend);
        if (start && end) {
          // iCal DTEND is exclusive for all-day events — store inclusive
          const fechaFin = new Date(end);
          fechaFin.setUTCDate(fechaFin.getUTCDate() - 1);
          if (fechaFin >= start) {
            events.push({
              fechaInicio: start,
              fechaFin,
              motivo: summary || "Bloqueado (OTA)",
            });
          }
        }
      }
      continue;
    }
    if (!inEvent) continue;

    // Extract value after first colon, handling property params (DTSTART;VALUE=DATE:...)
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).split(";")[0].toUpperCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "DTSTART") dtstart = value;
    else if (key === "DTEND") dtend = value;
    else if (key === "SUMMARY") summary = value;
  }

  return events;
}

export async function GET(req: NextRequest) {
  const cronSecret = req.headers.get("authorization");
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const feeds = await prisma.icalFeed.findMany({
    include: { tipoDeHabitacion: { select: { propiedadId: true } } },
  });

  let synced = 0;
  let errors = 0;

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const incoming = parseIcal(text);

      await prisma.bloqueoDetipo.deleteMany({ where: { icalFeedId: feed.id } });

      if (incoming.length > 0) {
        await prisma.bloqueoDetipo.createMany({
          data: incoming.map((e) => ({
            tipoDeHabitacionId: feed.tipoDeHabitacionId,
            propiedadId: feed.tipoDeHabitacion.propiedadId,
            fechaInicio: e.fechaInicio,
            fechaFin: e.fechaFin,
            motivo: e.motivo,
            icalFeedId: feed.id,
          })),
        });
      }

      await prisma.icalFeed.update({
        where: { id: feed.id },
        data: { lastSyncedAt: new Date() },
      });

      synced++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ synced, errors, total: feeds.length });
}
