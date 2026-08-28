"use client";

import { useFormStatus } from "react-dom";

export function GuardarNotasButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Guardando notas…" : "Guardar notas"}
    </button>
  );
}
