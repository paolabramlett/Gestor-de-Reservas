"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { reasignarHabitacionAction, cambiarFechasAction } from "./actions";

// ─── Types ───────────────────────────────────────────────────────────────────

type HabitacionData = {
  id: string;
  numero: string;
  tipoDeHabitacionId: string;
  tipoNombre: string;
};

type ReservaData = {
  id: string;
  codigoReserva: string;
  fechaIngreso: string;
  fechaSalida: string;
  numPersonas: number;
  totalMxn: number;
  estado: string;
  origen: string;
  tipoEspecial: string | null;
  tipoDeHabitacionId: string;
  nombreHuesped: string;
  huesped: { nombre: string; email: string; telefono: string | null };
  asignacion: { habitacionId: string } | null;
  pagoManual: { estadoDePago: string; montoAnticipo: number | null } | null;
};

type BloqueoData = {
  id: string;
  habitacionId: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string | null;
};

type DragState =
  | { type: "idle" }
  | {
      type: "moving";
      reservaId: string;
      originalHabitacionId: string;
      tipoDeHabitacionId: string;
      targetHabitacionId: string | null;
      startX: number;
      startY: number;
    }
  | {
      type: "resizing";
      reservaId: string;
      edge: "left" | "right";
      originalFechaIngreso: string;
      originalFechaSalida: string;
      startX: number;
      daysOffset: number;
    };

type TooltipState = {
  reserva: ReservaData;
  x: number;
  y: number;
} | null;

// ─── Constants ───────────────────────────────────────────────────────────────

const COL_W = 38; // px per day column
const ROW_H = 44; // px per room row
const LABEL_W = 88; // px for room label column
const HANDLE_W = 8; // px for resize handles

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + "T12:00:00");
  const db = new Date(b + "T12:00:00");
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function getMonthStart(año: number, mes: number): string {
  return isoDate(new Date(año, mes - 1, 1));
}

function getDaysInMonth(año: number, mes: number): number {
  return new Date(año, mes, 0).getDate();
}

function getBlockPos(
  fechaIngreso: string,
  fechaSalida: string,
  monthStart: string,
  daysInMonth: number
): { colStart: number; colEnd: number } | null {
  const start = daysBetween(monthStart, fechaIngreso);
  const end = daysBetween(monthStart, fechaSalida);
  const colStart = Math.max(0, start);
  const colEnd = Math.min(daysInMonth, end);
  if (colEnd <= colStart) return null;
  return { colStart, colEnd };
}

function getBlockColor(reserva: ReservaData): string {
  if (reserva.tipoEspecial === "CORTESIA") return "#9333ea";
  if (reserva.tipoEspecial === "PRECIO_ACORDADO") return "#0891b2";
  if (reserva.tipoEspecial === "PROMOCION") return "#db2777";
  if (reserva.estado === "EN_CURSO") return "#2563eb";
  if (reserva.origen === "ONLINE") return "#16a34a";
  const pago = reserva.pagoManual?.estadoDePago;
  if (pago === "PAGADO_COMPLETO") return "#16a34a";
  if (pago === "ANTICIPO_PAGADO") return "#ca8a04";
  return "#ea580c";
}

function formatMXN(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

const MES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DIA_ABREV = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"];

// ─── Component ───────────────────────────────────────────────────────────────

export function CalendarioGrid({
  habitaciones,
  reservas,
  bloqueos,
  mes,
  año,
}: {
  habitaciones: HabitacionData[];
  reservas: ReservaData[];
  bloqueos: BloqueoData[];
  mes: number;
  año: number;
}) {
  const router = useRouter();
  const [agrupacion, setAgrupacion] = useState<"numero" | "tipo">("numero");
  const [drag, setDrag] = useState<DragState>({ type: "idle" });
  const [tooltip, setTooltip] = useState<TooltipState>(null);
  const [confirm, setConfirm] = useState<{
    reservaId: string;
    nuevaFechaIngreso: string;
    nuevaFechaSalida: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const monthStart = getMonthStart(año, mes);
  const daysInMonth = getDaysInMonth(año, mes);
  const today = isoDate(new Date());
  const todayCol = daysBetween(monthStart, today);

  const days = Array.from({ length: daysInMonth }, (_, i) => i);

  const sortedRooms = useMemo(() => {
    const rooms = [...habitaciones];
    if (agrupacion === "numero") {
      return rooms.sort((a, b) =>
        a.numero.localeCompare(b.numero, undefined, { numeric: true })
      );
    }
    return rooms.sort((a, b) => {
      const t = a.tipoNombre.localeCompare(b.tipoNombre);
      if (t !== 0) return t;
      return a.numero.localeCompare(b.numero, undefined, { numeric: true });
    });
  }, [habitaciones, agrupacion]);

  const reservasByRoom = useMemo(() => {
    const map: Record<string, ReservaData[]> = {};
    for (const r of reservas) {
      if (r.asignacion) {
        const hid = r.asignacion.habitacionId;
        if (!map[hid]) map[hid] = [];
        map[hid].push(r);
      }
    }
    return map;
  }, [reservas]);

  const sinAsignar = useMemo(
    () => reservas.filter((r) => !r.asignacion),
    [reservas]
  );

  const bloqueosByRoom = useMemo(() => {
    const map: Record<string, BloqueoData[]> = {};
    for (const b of bloqueos) {
      if (!map[b.habitacionId]) map[b.habitacionId] = [];
      map[b.habitacionId].push(b);
    }
    return map;
  }, [bloqueos]);

  // Navigation
  const prevMes = mes === 1 ? 12 : mes - 1;
  const prevAño = mes === 1 ? año - 1 : año;
  const nextMes = mes === 12 ? 1 : mes + 1;
  const nextAño = mes === 12 ? año + 1 : año;

  // ─── Drag logic ──────────────────────────────────────────────────────────

  const handleBlockMouseDown = useCallback(
    (e: React.MouseEvent, reserva: ReservaData) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setTooltip(null);
      setDrag({
        type: "moving",
        reservaId: reserva.id,
        originalHabitacionId: reserva.asignacion?.habitacionId ?? "",
        tipoDeHabitacionId: reserva.tipoDeHabitacionId,
        targetHabitacionId: reserva.asignacion?.habitacionId ?? null,
        startX: e.clientX,
        startY: e.clientY,
      });
    },
    []
  );

  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent, reserva: ReservaData, edge: "left" | "right") => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      setTooltip(null);
      setDrag({
        type: "resizing",
        reservaId: reserva.id,
        edge,
        originalFechaIngreso: reserva.fechaIngreso,
        originalFechaSalida: reserva.fechaSalida,
        startX: e.clientX,
        daysOffset: 0,
      });
    },
    []
  );

  useEffect(() => {
    if (drag.type === "idle") return;

    const handleMouseMove = (e: MouseEvent) => {
      if (drag.type === "moving") {
        // Find which room row is under cursor
        let found: string | null = null;
        for (const [roomId, el] of Object.entries(rowRefs.current)) {
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            found = roomId;
            break;
          }
        }
        setDrag((prev) =>
          prev.type === "moving"
            ? { ...prev, targetHabitacionId: found }
            : prev
        );
      } else if (drag.type === "resizing") {
        const deltaX = e.clientX - drag.startX;
        const daysOffset = Math.round(deltaX / COL_W);
        setDrag((prev) =>
          prev.type === "resizing" ? { ...prev, daysOffset } : prev
        );
      }
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (drag.type === "moving") {
        const { reservaId, originalHabitacionId, targetHabitacionId, tipoDeHabitacionId, startX, startY } = drag;
        setDrag({ type: "idle" });

        // Click (no significant movement) → navigate to reservation
        const moved = Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5;
        if (!moved) {
          router.push(`/panel/reservas/${reservaId}`);
          return;
        }

        if (targetHabitacionId && targetHabitacionId !== originalHabitacionId) {
          const targetRoom = habitaciones.find((h) => h.id === targetHabitacionId);
          if (targetRoom?.tipoDeHabitacionId !== tipoDeHabitacionId) {
            setError("Solo se puede reasignar a habitaciones del mismo tipo");
          } else {
            setPending(true);
            const result = await reasignarHabitacionAction(reservaId, targetHabitacionId);
            setPending(false);
            if (result.error) setError(result.error);
            else { setSuccessMsg("Habitación reasignada"); router.refresh(); setTimeout(() => setSuccessMsg(null), 3500); }
          }
        }
      } else if (drag.type === "resizing") {
        const { reservaId, edge, originalFechaIngreso, originalFechaSalida, daysOffset } = drag;
        setDrag({ type: "idle" });

        if (daysOffset !== 0) {
          const nuevaFechaIngreso =
            edge === "left" ? addDays(originalFechaIngreso, daysOffset) : originalFechaIngreso;
          const nuevaFechaSalida =
            edge === "right" ? addDays(originalFechaSalida, daysOffset) : originalFechaSalida;

          if (daysBetween(nuevaFechaIngreso, nuevaFechaSalida) >= 1) {
            setConfirm({ reservaId, nuevaFechaIngreso, nuevaFechaSalida });
          }
        }
      } else {
        setDrag({ type: "idle" });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [drag, habitaciones, router]);

  const handleConfirmFechas = async () => {
    if (!confirm) return;
    setPending(true);
    const result = await cambiarFechasAction(
      confirm.reservaId,
      confirm.nuevaFechaIngreso,
      confirm.nuevaFechaSalida
    );
    setPending(false);
    setConfirm(null);
    if (result.error) setError(result.error);
    else {
      setSuccessMsg(result.precioAcordado ? "Fechas actualizadas · Verifica el precio acordado en la reserva" : "Fechas actualizadas");
      router.refresh();
      setTimeout(() => setSuccessMsg(null), 5000);
    }
  };

  // ─── Visual drag overlay ──────────────────────────────────────────────────

  const getDragVisualDates = (reserva: ReservaData): { fi: string; fs: string } => {
    if (drag.type === "resizing" && drag.reservaId === reserva.id) {
      const fi =
        drag.edge === "left"
          ? addDays(drag.originalFechaIngreso, drag.daysOffset)
          : reserva.fechaIngreso;
      const fs =
        drag.edge === "right"
          ? addDays(drag.originalFechaSalida, drag.daysOffset)
          : reserva.fechaSalida;
      return { fi, fs };
    }
    return { fi: reserva.fechaIngreso, fs: reserva.fechaSalida };
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  const isDraggingRoom = drag.type === "moving";

  return (
    <div className="select-none" style={{ cursor: drag.type !== "idle" ? "grabbing" : undefined }}>
      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <a
            href={`/panel/calendario?mes=${prevMes}&año=${prevAño}`}
            className="px-2 py-1 rounded border border-gray-300 text-sm hover:bg-gray-50"
          >
            ←
          </a>

          {/* Dropdowns mes + año */}
          <div className="flex items-center gap-1">
            <select
              value={mes}
              onChange={(e) => router.push(`/panel/calendario?mes=${e.target.value}&año=${año}`)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white cursor-pointer"
            >
              {MES_NOMBRES.map((nombre, i) => (
                <option key={i} value={i + 1}>{nombre}</option>
              ))}
            </select>
            <select
              value={año}
              onChange={(e) => router.push(`/panel/calendario?mes=${mes}&año=${e.target.value}`)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-sm bg-white cursor-pointer w-20"
            >
              {Array.from({ length: 5 }, (_, i) => año - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <a
            href={`/panel/calendario?mes=${nextMes}&año=${nextAño}`}
            className="px-2 py-1 rounded border border-gray-300 text-sm hover:bg-gray-50"
          >
            →
          </a>
        </div>

        {/* Group toggle */}
        <div className="flex rounded border border-gray-300 overflow-hidden text-sm">
          <button
            onClick={() => setAgrupacion("numero")}
            className={`px-3 py-1 ${agrupacion === "numero" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Por número
          </button>
          <button
            onClick={() => setAgrupacion("tipo")}
            className={`px-3 py-1 ${agrupacion === "tipo" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            Por tipo
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-3 text-xs flex-wrap">
          {[
            { color: "#16a34a", label: "Pago completo" },
            { color: "#ca8a04", label: "Anticipo" },
            { color: "#ea580c", label: "Sin depósito" },
            { color: "#2563eb", label: "En curso" },
            { color: "#9333ea", label: "Cortesía" },
            { color: "#0891b2", label: "Precio acordado" },
            { color: "#db2777", label: "Promoción" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{
                backgroundColor: "#9ca3af",
                backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(0,0,0,.15) 2px,rgba(0,0,0,.15) 4px)",
              }}
            />
            <span className="text-gray-600">Bloqueada</span>
          </div>
        </div>

        {/* Nueva reserva */}
        <a
          href="/panel/reservas/nueva?from=calendario"
          className="ml-auto rounded-lg bg-gray-900 text-white px-4 py-1.5 text-sm font-medium hover:bg-gray-700 flex-shrink-0"
        >
          + Nueva reserva
        </a>

        {pending && (
          <span className="text-xs text-gray-500 animate-pulse">Guardando...</span>
        )}
      </div>

      {/* Sin asignar banner */}
      {sinAsignar.length > 0 && (
        <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-sm text-amber-800">
          {sinAsignar.length} reserva{sinAsignar.length > 1 ? "s" : ""} sin habitación asignada este mes:{" "}
          {sinAsignar.map((r, i) => (
            <span key={r.id}>
              {i > 0 && ", "}
              <a
                href={`/panel/reservas/${r.id}`}
                className="font-medium underline underline-offset-2 hover:text-amber-900"
              >
                {r.codigoReserva}
              </a>
            </span>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <div style={{ minWidth: LABEL_W + daysInMonth * COL_W }}>
          {/* Header row */}
          <div className="flex border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
            <div
              className="flex-shrink-0 border-r border-gray-200 bg-gray-50"
              style={{ width: LABEL_W }}
            />
            {days.map((i) => {
              const date = new Date(año, mes - 1, i + 1);
              const dow = date.getDay();
              const isToday = i === todayCol;
              const isWeekend = dow === 0 || dow === 6;
              return (
                <div
                  key={i}
                  className={`flex-shrink-0 text-center text-xs py-1 border-r border-gray-100 ${
                    isToday ? "bg-blue-100 font-semibold text-blue-700" : isWeekend ? "text-gray-400" : "text-gray-600"
                  }`}
                  style={{ width: COL_W }}
                >
                  <div>{i + 1}</div>
                  <div className="text-gray-400 text-[10px]">{DIA_ABREV[dow]}</div>
                </div>
              );
            })}
          </div>

          {/* Room rows */}
          {sortedRooms.map((room, roomIdx) => {
            const roomReservas = reservasByRoom[room.id] ?? [];
            const roomBloqueos = bloqueosByRoom[room.id] ?? [];
            const isTarget = drag.type === "moving" && drag.targetHabitacionId === room.id;
            const isOriginal = drag.type === "moving" && drag.originalHabitacionId === room.id;

            // Show tipo label when grouping by tipo and first in group
            const showTipoLabel =
              agrupacion === "tipo" &&
              (roomIdx === 0 || sortedRooms[roomIdx - 1].tipoNombre !== room.tipoNombre);

            return (
              <div key={room.id}>
                {showTipoLabel && (
                  <div className="px-3 py-1 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100 uppercase tracking-wide">
                    {room.tipoNombre}
                  </div>
                )}
                <div
                  className={`flex border-b border-gray-100 relative transition-colors ${
                    isTarget ? "bg-blue-50" : isOriginal && isDraggingRoom ? "bg-gray-100" : "hover:bg-gray-50/50"
                  }`}
                  style={{ height: ROW_H }}
                  ref={(el) => { rowRefs.current[room.id] = el; }}
                  data-room-id={room.id}
                >
                  {/* Room label */}
                  <div
                    className="flex-shrink-0 flex items-center px-3 border-r border-gray-200 sticky left-0 bg-white z-10 text-sm font-medium text-gray-700"
                    style={{ width: LABEL_W }}
                  >
                    {room.numero}
                  </div>

                  {/* Day cells background */}
                  <div className="flex" style={{ width: daysInMonth * COL_W }}>
                    {days.map((i) => {
                      const isToday = i === todayCol;
                      const dow = new Date(año, mes - 1, i + 1).getDay();
                      return (
                        <div
                          key={i}
                          className={`flex-shrink-0 border-r border-gray-100 ${
                            isToday ? "bg-blue-50" : dow === 0 || dow === 6 ? "bg-gray-50/60" : ""
                          }`}
                          style={{ width: COL_W, height: ROW_H }}
                        />
                      );
                    })}
                  </div>

                  {/* Bloqueo blocks */}
                  {roomBloqueos.map((b) => {
                    const pos = getBlockPos(b.fechaInicio, addDays(b.fechaFin, 1), monthStart, daysInMonth);
                    if (!pos) return null;
                    return (
                      <div
                        key={b.id}
                        title={b.motivo ?? "Bloqueada"}
                        className="absolute top-1.5 rounded overflow-hidden"
                        style={{
                          left: LABEL_W + pos.colStart * COL_W + 1,
                          width: (pos.colEnd - pos.colStart) * COL_W - 2,
                          height: ROW_H - 12,
                          backgroundColor: "#9ca3af",
                          backgroundImage:
                            "repeating-linear-gradient(45deg,transparent,transparent 4px,rgba(0,0,0,.12) 4px,rgba(0,0,0,.12) 8px)",
                        }}
                      />
                    );
                  })}

                  {/* Reservation blocks */}
                  {roomReservas.map((reserva) => {
                    const { fi, fs } = getDragVisualDates(reserva);
                    const pos = getBlockPos(fi, fs, monthStart, daysInMonth);
                    if (!pos) return null;

                    const color = getBlockColor(reserva);
                    const isMoving = drag.type === "moving" && drag.reservaId === reserva.id;
                    const isResizing = drag.type === "resizing" && drag.reservaId === reserva.id;
                    const nights = daysBetween(reserva.fechaIngreso, reserva.fechaSalida);
                    const blockW = (pos.colEnd - pos.colStart) * COL_W - 2;

                    return (
                      <div
                        key={reserva.id}
                        className="absolute top-1.5 rounded text-white text-xs flex items-center overflow-hidden transition-opacity"
                        style={{
                          left: LABEL_W + pos.colStart * COL_W + 1,
                          width: blockW,
                          height: ROW_H - 12,
                          backgroundColor: color,
                          opacity: isMoving ? 0.5 : 1,
                          cursor: isResizing ? "ew-resize" : "grab",
                          zIndex: isMoving || isResizing ? 20 : 5,
                          boxShadow: isMoving || isResizing ? "0 2px 8px rgba(0,0,0,.3)" : undefined,
                        }}
                        onMouseDown={(e) => handleBlockMouseDown(e, reserva)}
                        onMouseEnter={(e) => {
                          if (drag.type === "idle") {
                            setTooltip({ reserva, x: e.clientX, y: e.clientY });
                          }
                        }}
                        onMouseMove={(e) => {
                          if (drag.type === "idle") {
                            setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : null));
                          }
                        }}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {/* Left resize handle */}
                        <div
                          className="absolute left-0 top-0 bottom-0 z-10"
                          style={{ width: HANDLE_W, cursor: "ew-resize" }}
                          onMouseDown={(e) => handleResizeMouseDown(e, reserva, "left")}
                        />

                        {/* Content */}
                        <div className="flex-1 px-2 truncate min-w-0" style={{ paddingLeft: HANDLE_W + 4 }}>
                          {blockW > 50 && (
                            <span className="font-medium truncate">
                              {reserva.nombreHuesped || reserva.huesped.nombre.split(" ")[0]}
                            </span>
                          )}
                          {blockW > 80 && nights > 0 && (
                            <span className="opacity-80 ml-1">{nights}n</span>
                          )}
                        </div>

                        {/* Origin indicator */}
                        {blockW > 40 && (
                          <div
                            className="flex-shrink-0 mr-1 text-[9px] opacity-75"
                            title={reserva.origen === "ONLINE" ? "Online" : "Manual"}
                          >
                            {reserva.origen === "ONLINE" ? "🌐" : "✏️"}
                          </div>
                        )}

                        {/* Right resize handle */}
                        <div
                          className="absolute right-0 top-0 bottom-0 z-10"
                          style={{ width: HANDLE_W, cursor: "ew-resize" }}
                          onMouseDown={(e) => handleResizeMouseDown(e, reserva, "right")}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && drag.type === "idle" && (
        <div
          className="fixed z-50 bg-gray-900 text-white text-xs rounded-lg shadow-xl p-3 pointer-events-none"
          style={{
            left: Math.min(tooltip.x + 12, window.innerWidth - 220),
            top: tooltip.y + 12,
            maxWidth: 200,
          }}
        >
          <div className="font-semibold mb-1">{tooltip.reserva.nombreHuesped || tooltip.reserva.huesped.nombre}</div>
          <div className="text-gray-300 mb-1">{tooltip.reserva.codigoReserva}</div>
          <div>
            {formatDate(tooltip.reserva.fechaIngreso)} → {formatDate(tooltip.reserva.fechaSalida)}
          </div>
          <div>{daysBetween(tooltip.reserva.fechaIngreso, tooltip.reserva.fechaSalida)} noches · {tooltip.reserva.numPersonas} pax</div>
          <div className="font-medium mt-1">{formatMXN(tooltip.reserva.totalMxn)}</div>
          {/* Anticipo y saldo */}
          {tooltip.reserva.pagoManual?.estadoDePago === "ANTICIPO_PAGADO" &&
            tooltip.reserva.pagoManual.montoAnticipo != null && (
              <div className="mt-1 space-y-0.5">
                <div className="flex justify-between text-gray-300">
                  <span>Anticipo</span>
                  <span>{formatMXN(tooltip.reserva.pagoManual.montoAnticipo)}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-medium">
                  <span>Falta</span>
                  <span>{formatMXN(tooltip.reserva.totalMxn - tooltip.reserva.pagoManual.montoAnticipo)}</span>
                </div>
              </div>
            )}
          {tooltip.reserva.tipoEspecial && (
            <div className="mt-1 text-purple-300 capitalize">
              {tooltip.reserva.tipoEspecial.replace(/_/g, " ").toLowerCase()}
            </div>
          )}
          <div className="mt-1 text-gray-400">
            {tooltip.reserva.origen === "ONLINE" ? "🌐 Online" : "✏️ Manual"}
            {" · "}
            {tooltip.reserva.pagoManual?.estadoDePago?.replace(/_/g, " ").toLowerCase() ??
              tooltip.reserva.estado.toLowerCase()}
          </div>
          {tooltip.reserva.huesped.telefono && (
            <div className="text-gray-400">{tooltip.reserva.huesped.telefono}</div>
          )}
        </div>
      )}

      {/* Confirm date change dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h2 className="text-base font-semibold text-gray-900 mb-3">
              Confirmar cambio de fechas
            </h2>
            <p className="text-sm text-gray-700 mb-4">
              ¿Cambiar las fechas de la reserva a{" "}
              <strong>{formatDate(confirm.nuevaFechaIngreso)}</strong> →{" "}
              <strong>{formatDate(confirm.nuevaFechaSalida)}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmFechas}
                disabled={pending}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {pending ? "Guardando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {successMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-xl">
          <span className="text-green-400">✓</span>
          {successMsg}
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white text-sm rounded-lg shadow-xl px-4 py-3 flex items-center gap-3">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-white/80 hover:text-white font-medium"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
