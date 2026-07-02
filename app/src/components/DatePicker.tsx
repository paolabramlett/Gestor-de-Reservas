"use client";

import { useEffect, useRef, useState } from "react";

const MES_NOMBRES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIA_ABREV = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay(); // 0=Sun … 6=Sat
  return day === 0 ? 6 : day - 1; // convert to Mon=0 … Sun=6
}

type SelectedDate = { year: number; month: number; day: number };

function parseISO(iso?: string): SelectedDate | null {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

function toISO(s: SelectedDate): string {
  return `${s.year}-${String(s.month + 1).padStart(2, "0")}-${String(s.day).padStart(2, "0")}`;
}

function formatDisplay(s: SelectedDate | null): string {
  if (!s) return "";
  return new Date(s.year, s.month, s.day).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function DatePicker({
  name,
  defaultValue,
  value,
  required,
  min,
  max,
  colorPrimario,
  onChange,
}: {
  name: string;
  defaultValue?: string;
  value?: string;
  required?: boolean;
  min?: string;
  max?: string;
  colorPrimario?: string;
  onChange?: (iso: string) => void;
}) {
  const today = new Date();
  const todayObj: SelectedDate = {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  };

  const [selected, setSelected] = useState<SelectedDate | null>(parseISO(value ?? defaultValue));
  const [viewYear, setViewYear] = useState(selected?.year ?? todayObj.year);
  const [viewMonth, setViewMonth] = useState(selected?.month ?? todayObj.month);

  // Sync internal state when controlled value changes from parent
  useEffect(() => {
    if (value === undefined) return;
    const parsed = parseISO(value);
    setSelected(parsed);
    if (parsed) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click + detect overflow direction
  useEffect(() => {
    if (!open) return;
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setAlignRight(rect.left + 288 > window.innerWidth - 8);
    }
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const isoValue = selected ? toISO(selected) : "";

  // Build calendar grid (Mon-first)
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (day: number) =>
    selected?.year === viewYear && selected?.month === viewMonth && selected?.day === day;

  const isToday = (day: number) =>
    todayObj.year === viewYear && todayObj.month === viewMonth && todayObj.day === day;

  const isDisabled = (day: number) => {
    const iso = toISO({ year: viewYear, month: viewMonth, day });
    if (min && iso < min) return true;
    if (max && iso > max) return true;
    return false;
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => todayObj.year - 1 + i);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const handleSelect = (day: number) => {
    if (isDisabled(day)) return;
    const s = { year: viewYear, month: viewMonth, day };
    setSelected(s);
    onChange?.(toISO(s));
  };

  const handleConfirm = () => setOpen(false);

  const handleClear = () => { setSelected(null); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={isoValue} required={required} />

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-3 py-2 text-sm text-left hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 bg-white"
      >
        <span className={selected ? "text-gray-900" : "text-gray-400"}>
          {selected ? formatDisplay(selected) : "Seleccionar fecha"}
        </span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div className={`absolute top-full mt-1 z-50 bg-white rounded-xl border border-gray-200 shadow-xl p-4 w-72 ${alignRight ? "right-0" : "left-0"}`}>

          {/* Header: month/year with nav arrows */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            <div className="flex gap-1.5 flex-1">
              <select
                value={viewMonth}
                onChange={e => setViewMonth(Number(e.target.value))}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-sm bg-gray-50 focus:outline-none focus:border-gray-400 cursor-pointer"
              >
                {MES_NOMBRES.map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={viewYear}
                onChange={e => setViewYear(Number(e.target.value))}
                className="w-[72px] border border-gray-200 rounded-lg px-2 py-1 text-sm bg-gray-50 focus:outline-none focus:border-gray-400 cursor-pointer"
              >
                {yearOptions.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-900"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DIA_ABREV.map(d => (
              <div key={d} className="text-center text-[11px] text-gray-400 font-medium py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day ? (
                  <button
                    type="button"
                    onClick={() => handleSelect(day)}
                    disabled={isDisabled(day)}
                    style={isSelected(day) && colorPrimario ? { backgroundColor: colorPrimario } : undefined}
                    className={`w-8 h-8 rounded-full text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                      isSelected(day)
                        ? colorPrimario ? "text-white font-semibold" : "bg-gray-900 text-white font-semibold"
                        : isToday(day)
                        ? "border-2 border-gray-300 text-gray-900 font-medium hover:bg-gray-100"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {day}
                  </button>
                ) : (
                  <div className="w-8 h-8" />
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={handleClear}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Borrar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              style={colorPrimario ? { backgroundColor: colorPrimario } : undefined}
              className={`rounded-lg text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 transition-opacity ${!colorPrimario ? "bg-gray-900" : ""}`}
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
