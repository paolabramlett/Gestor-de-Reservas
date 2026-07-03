"use client";

import { useTransition } from "react";
import { desvincularReservaDelGrupoAction, eliminarGrupoAction } from "../actions";

export function BotonDesvincular({ reservaId, grupoId }: { reservaId: string; grupoId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("¿Desvincular esta reserva del grupo? La reserva no se eliminará.")) return;
        const fd = new FormData();
        fd.append("reservaId", reservaId);
        fd.append("grupoId", grupoId);
        startTransition(() => desvincularReservaDelGrupoAction(fd));
      }}
      className="text-xs text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
    >
      {pending ? "Desvinculando..." : "Desvincular"}
    </button>
  );
}

export function BotonEliminarGrupo({ grupoId }: { grupoId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm("¿Eliminar este grupo? Las reservas no se borrarán.")) return;
        const fd = new FormData();
        fd.append("grupoId", grupoId);
        startTransition(() => eliminarGrupoAction(fd));
      }}
      className="w-full rounded-lg border border-red-200 text-red-600 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "Eliminando..." : "Eliminar grupo"}
    </button>
  );
}
