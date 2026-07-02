import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import ical, { VEvent } from "node-ical";

export const runtime = "nodejs";
export const maxDuration = 60;

function toDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  if (typeof val === "string") {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
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
      const events = await ical.async.fromURL(feed.url);

      const incoming: { fechaInicio: Date; fechaFin: Date; motivo: string }[] = [];

      for (const event of Object.values(events)) {
        if (!event || event.type !== "VEVENT") continue;
        const vevent = event as VEvent;
        const start = toDate(vevent.start);
        const end = toDate(vevent.end);
        if (!start || !end) continue;

        // iCal DTEND for all-day events is exclusive — store inclusive fechaFin
        const fechaFin = new Date(end);
        fechaFin.setUTCDate(fechaFin.getUTCDate() - 1);
        if (fechaFin < start) continue;

        incoming.push({
          fechaInicio: start,
          fechaFin,
          motivo: (vevent.summary as string | undefined) || "Bloqueado (OTA)",
        });
      }

      // Delete existing bloqueos from this feed and recreate
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
