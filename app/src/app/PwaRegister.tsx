"use client";

import { useEffect } from "react";

// Registra un service worker mínimo solo para que Chrome/Android consideren
// el sitio "instalable". No cachea nada — cada request sigue yendo a la red,
// así que los datos siempre están frescos (sin comportamiento offline).
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
