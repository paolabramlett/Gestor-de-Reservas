"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function SuccessToastInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [esError, setEsError] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const success = searchParams.get("success");
    // Solo tomar "error" en páginas que no lo renderizan inline por su cuenta
    // (esas lo manejan mejor con contexto). Las demás quedan cubiertas aquí.
    const paginaConErrorInline =
      pathname.startsWith("/panel/configuracion") ||
      /^\/panel\/reservas\/(?!nueva$)[^/]+$/.test(pathname) ||
      /^\/panel\/grupos\/(?!nuevo$)[^/]+$/.test(pathname);
    const error = paginaConErrorInline ? null : searchParams.get("error");
    const msg = success ?? error;
    if (!msg) return;

    // Clean the URL immediately
    const params = new URLSearchParams(searchParams.toString());
    params.delete(success ? "success" : "error");
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(newUrl, { scroll: false });

    setMessage(decodeURIComponent(msg));
    setEsError(!success);
    setVisible(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), success ? 3500 : 7000);
  }, [searchParams, pathname, router]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!message) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-xl transition-all duration-500 ${
        esError ? "bg-red-700" : "bg-gray-900"
      } ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"}`}
      onTransitionEnd={() => { if (!visible) setMessage(null); }}
    >
      <span className="flex-shrink-0">{esError ? "⚠" : <span className="text-green-400">✓</span>}</span>
      {message}
    </div>
  );
}

// Wrapped in Suspense because useSearchParams() requires it in Next.js App Router
import { Suspense } from "react";

export function SuccessToast() {
  return (
    <Suspense>
      <SuccessToastInner />
    </Suspense>
  );
}
