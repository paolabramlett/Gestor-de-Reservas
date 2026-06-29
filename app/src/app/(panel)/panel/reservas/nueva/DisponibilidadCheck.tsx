"use client";

import { useEffect, useState } from "react";
import { verificarDisponibilidadAction } from "../actions";

export default function DisponibilidadCheck() {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const form = document.querySelector("form");
    if (!form) return;

    const check = async () => {
      const tipo = (form.querySelector("[name=tipoDeHabitacionId]") as HTMLSelectElement)?.value;
      const ingreso = (form.querySelector("[name=fechaIngreso]") as HTMLInputElement)?.value;
      const salida = (form.querySelector("[name=fechaSalida]") as HTMLInputElement)?.value;
      if (!tipo || !ingreso || !salida) return;
      setChecking(true);
      try {
        const { disponible } = await verificarDisponibilidadAction(tipo, ingreso, salida);
        setDisponible(disponible);
      } finally {
        setChecking(false);
      }
    };

    const inputs = form.querySelectorAll("[name=tipoDeHabitacionId],[name=fechaIngreso],[name=fechaSalida]");
    inputs.forEach((el) => el.addEventListener("change", check));
    return () => inputs.forEach((el) => el.removeEventListener("change", check));
  }, []);

  if (disponible === null) return null;

  return (
    <div className={`rounded-lg px-4 py-3 text-sm font-medium ${disponible ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
      {checking ? "Verificando disponibilidad..." : disponible ? "✓ Hay disponibilidad para las fechas seleccionadas" : "⚠ Sin disponibilidad para las fechas seleccionadas"}
    </div>
  );
}
