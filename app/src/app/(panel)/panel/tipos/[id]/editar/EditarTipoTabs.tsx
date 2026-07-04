"use client";

import { useState, type ReactNode } from "react";

type Tab = "detalles" | "ical";

export function EditarTipoTabs({
  detalles,
  ical,
}: {
  detalles: ReactNode;
  ical: ReactNode | null;
}) {
  const [tab, setTab] = useState<Tab>("detalles");

  const tabs: { id: Tab; label: string }[] = [
    { id: "detalles", label: "Detalles" },
    ...(ical ? [{ id: "ical" as Tab, label: "Sincronización iCal" }] : []),
  ];

  return (
    <div>
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((t) => (
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

      {tab === "detalles" && detalles}
      {tab === "ical" && ical}
    </div>
  );
}
