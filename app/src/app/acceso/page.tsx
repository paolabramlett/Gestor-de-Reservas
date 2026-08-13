"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { continuarAlInicioSesion } from "./flujo";

export default function AccesoPage() {
  const { isLoaded, sessionId } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();
  const iniciado = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isLoaded || iniciado.current) return;
    iniciado.current = true;

    continuarAlInicioSesion(sessionId, signOut, (ruta) => router.replace(ruta)).catch(() => {
      iniciado.current = false;
      setError(true);
    });
  }, [isLoaded, router, sessionId, signOut]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="text-center">
        <Image
          src="/roomly-logo.png"
          alt="Roomly"
          width={170}
          height={44}
          priority
          className="mx-auto mb-8 object-contain"
        />
        {error ? (
          <>
            <p className="mb-4 text-gray-700">No pudimos preparar el inicio de sesión.</p>
            <button
              type="button"
              className="rounded-lg bg-[#041B42] px-5 py-3 font-semibold text-white"
              onClick={() => window.location.reload()}
            >
              Intentar nuevamente
            </button>
          </>
        ) : (
          <p className="text-gray-600">Preparando tu inicio de sesión…</p>
        )}
      </div>
    </main>
  );
}
