"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

function SuccessToastInner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const msg = searchParams.get("success");
    if (!msg) return;

    // Clean the URL immediately
    const params = new URLSearchParams(searchParams.toString());
    params.delete("success");
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname;
    router.replace(newUrl, { scroll: false });

    setMessage(decodeURIComponent(msg));
    setVisible(true);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 3500);
  }, [searchParams, pathname, router]);

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!message) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm text-white shadow-xl transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
      }`}
      onTransitionEnd={() => { if (!visible) setMessage(null); }}
    >
      <span className="flex-shrink-0 text-green-400">✓</span>
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
