"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Paso = {
  id: string;
  label: string;
  descripcion: string;
  completado: boolean;
  href: string;
  cta: string;
};

const DISMISS_KEY = "roomly_onboarding_dismissed";

export function OnboardingChecklist({ pasos }: { pasos: Paso[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const completados = pasos.filter((p) => p.completado).length;
  const todos = pasos.length;
  const pct = Math.round((completados / todos) * 100);

  if (!visible || completados === todos) return null;

  return (
    <div className="mb-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Configura tu hotel — {completados} de {todos} completados
            </h2>
            <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              {pct}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>

      <ul className="divide-y divide-gray-50">
        {pasos.map((paso) => (
          <li key={paso.id} className="flex items-center gap-4 px-5 py-3.5">
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                paso.completado
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-gray-300"
              }`}
            >
              {paso.completado && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 8">
                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${paso.completado ? "text-gray-400 line-through" : "text-gray-900"}`}>
                {paso.label}
              </p>
              {!paso.completado && (
                <p className="text-xs text-gray-400 mt-0.5">{paso.descripcion}</p>
              )}
            </div>
            {!paso.completado && (
              <Link
                href={paso.href}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 shrink-0 whitespace-nowrap"
              >
                {paso.cta} →
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
