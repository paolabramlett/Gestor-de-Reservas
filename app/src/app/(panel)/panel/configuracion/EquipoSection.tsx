"use client";

import { useState } from "react";

const ROL_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  RESERVACIONES: "Reservaciones",
  FINANZAS: "Finanzas",
};

export type MiembroEquipo = {
  usuarioPropiedadId: string;
  nombre: string;
  email: string;
  rol: string;
  esYo: boolean;
};

export type InvitacionPendiente = {
  id: string;
  email: string;
  rol: string;
  expiraEn: string;
};

type Props = {
  miembros: MiembroEquipo[];
  invitaciones: InvitacionPendiente[];
  enviarInvitacionAction: (fd: FormData) => Promise<void>;
  cancelarInvitacionAction: (fd: FormData) => Promise<void>;
  actualizarRolUsuarioAction: (fd: FormData) => Promise<void>;
  quitarUsuarioAction: (fd: FormData) => Promise<void>;
};

export function EquipoSection({
  miembros,
  invitaciones,
  enviarInvitacionAction,
  cancelarInvitacionAction,
  actualizarRolUsuarioAction,
  quitarUsuarioAction,
}: Props) {
  const [confirmQuitar, setConfirmQuitar] = useState<MiembroEquipo | null>(null);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">Equipo</h2>

      {/* Miembros actuales */}
      <div className="space-y-2 mb-5">
        {miembros.map((m) => (
          <div key={m.usuarioPropiedadId} className="flex items-center justify-between gap-3 border border-gray-100 rounded-lg px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {m.nombre} {m.esYo && <span className="text-gray-400 font-normal">(tú)</span>}
              </p>
              <p className="text-xs text-gray-400 truncate">{m.email}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <form action={actualizarRolUsuarioAction}>
                <input type="hidden" name="usuarioPropiedadId" value={m.usuarioPropiedadId} />
                <select
                  name="rol"
                  defaultValue={m.rol}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                >
                  <option value="ADMIN">Administrador</option>
                  <option value="RESERVACIONES">Reservaciones</option>
                  <option value="FINANZAS">Finanzas</option>
                </select>
              </form>
              {!m.esYo && (
                <button
                  type="button"
                  onClick={() => setConfirmQuitar(m)}
                  className="text-xs text-red-500 hover:text-red-700 px-1"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invitaciones pendientes */}
      {invitaciones.length > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Invitaciones pendientes</p>
          <div className="space-y-2">
            {invitaciones.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 truncate">{inv.email}</p>
                  <p className="text-xs text-amber-700">{ROL_LABEL[inv.rol] ?? inv.rol} · expira {inv.expiraEn}</p>
                </div>
                <form action={cancelarInvitacionAction}>
                  <input type="hidden" name="invitacionId" value={inv.id} />
                  <button type="submit" className="text-xs text-gray-500 hover:text-red-600 shrink-0">
                    Cancelar
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invitar a alguien nuevo */}
      <form action={enviarInvitacionAction} className="border-t border-gray-100 pt-4 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs text-gray-500 mb-1">Invitar por correo</label>
          <input
            type="email"
            name="email"
            required
            placeholder="correo@ejemplo.com"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Rol</label>
          <select name="rol" defaultValue="RESERVACIONES" className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="ADMIN">Administrador</option>
            <option value="RESERVACIONES">Reservaciones</option>
            <option value="FINANZAS">Finanzas</option>
          </select>
        </div>
        <button type="submit" className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium hover:bg-gray-700">
          Enviar invitación
        </button>
      </form>

      {confirmQuitar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-2">¿Quitar a {confirmQuitar.nombre}?</h2>
            <p className="text-sm text-gray-500 mb-4">
              Perderá acceso inmediato al panel de este hotel. Puedes volver a invitarlo cuando quieras.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmQuitar(null)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
              >
                Volver
              </button>
              <form
                action={quitarUsuarioAction}
                className="flex-1"
                onSubmit={() => setConfirmQuitar(null)}
              >
                <input type="hidden" name="usuarioPropiedadId" value={confirmQuitar.usuarioPropiedadId} />
                <button type="submit" className="w-full rounded-lg bg-red-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-red-700">
                  Sí, quitar
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
