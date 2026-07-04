"use client";

import { useState, type ReactNode } from "react";

type Tab = "hotel" | "horarios" | "plan" | "equipo";

const TABS: { id: Tab; label: string }[] = [
  { id: "hotel", label: "Hotel" },
  { id: "horarios", label: "Horarios" },
  { id: "plan", label: "Plan" },
  { id: "equipo", label: "Equipo" },
];

export function ConfiguracionTabs({
  initialTab,
  hotel,
  horarios,
  plan,
  equipo,
}: {
  initialTab: Tab;
  hotel: ReactNode;
  horarios: ReactNode;
  plan: ReactNode;
  equipo: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const contenido: Record<Tab, ReactNode> = { hotel, horarios, plan, equipo };

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-gray-900 text-gray-900"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {contenido[tab]}
    </div>
  );
}
