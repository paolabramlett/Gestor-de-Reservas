"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
  ConnectAccountOnboarding,
  ConnectComponentsProvider,
} from "@stripe/react-connect-js";

async function solicitarClientSecret(): Promise<string> {
  const response = await fetch("/api/stripe-connect/account-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const body = (await response.json()) as { clientSecret?: string; error?: string };

  if (!response.ok || !body.clientSecret) {
    throw new Error(body.error ?? "No pudimos iniciar Stripe Connect");
  }

  return body.clientSecret;
}

export function StripeConnectEmbedded({ publishableKey }: { publishableKey: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [connectInstance] = useState(() =>
    loadConnectAndInitialize({
      publishableKey,
      fetchClientSecret: solicitarClientSecret,
      locale: "es-419",
      appearance: {
        overlays: "dialog",
        variables: {
          colorPrimary: "#111827",
          colorText: "#111827",
          colorBackground: "#ffffff",
          borderRadius: "8px",
          fontFamily: "Arial, Helvetica, sans-serif",
        },
      },
    })
  );

  const actualizarEstado = useCallback(async () => {
    setCargando(true);
    try {
      const response = await fetch("/api/stripe-connect/status", { method: "POST" });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "No pudimos actualizar el estado de Stripe");
      }
      setError(null);
      router.refresh();
    } catch (statusError) {
      setError(
        statusError instanceof Error
          ? statusError.message
          : "No pudimos actualizar el estado de Stripe"
      );
    } finally {
      setCargando(false);
    }
  }, [router]);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2 sm:p-4">
      {cargando && !error && (
        <p className="px-2 py-3 text-sm text-gray-500">Cargando configuración segura de Stripe…</p>
      )}
      {error && (
        <div className="m-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} Puedes continuar con el formulario alojado de respaldo.
        </div>
      )}
      <ConnectComponentsProvider connectInstance={connectInstance}>
        <ConnectAccountOnboarding
          collectionOptions={{ fields: "eventually_due", futureRequirements: "include" }}
          onLoaderStart={() => setCargando(false)}
          onLoadError={({ error: loadError }) => {
            setCargando(false);
            setError(loadError.message ?? "No pudimos cargar Stripe Connect");
          }}
          onExit={actualizarEstado}
        />
      </ConnectComponentsProvider>
    </div>
  );
}
