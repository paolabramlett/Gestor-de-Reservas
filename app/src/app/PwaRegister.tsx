"use client";

import { useEffect } from "react";

// Registra un service worker mínimo solo para que Chrome/Android consideren
// el sitio "instalable". No cachea nada — cada request sigue yendo a la red,
// así que los datos siempre están frescos (sin comportamiento offline).
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        // Fuerza revisar si hay una versión nueva de sw.js en cada carga,
        // en vez de esperar al intervalo lento por default del navegador
        // (hasta 24h). Así una corrección al service worker se aplica de
        // inmediato en vez de quedar atascada con una versión vieja.
        registration.update().catch(() => {});

        // Si ya hay una versión nueva esperando, actívala ahora mismo.
        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
        registration.addEventListener("updatefound", () => {
          const nuevoWorker = registration.installing;
          nuevoWorker?.addEventListener("statechange", () => {
            if (nuevoWorker.state === "installed" && registration.waiting) {
              registration.waiting.postMessage({ type: "SKIP_WAITING" });
            }
          });
        });
      })
      .catch(() => {});

    // Si el service worker activo cambia (nueva versión toma control),
    // recarga una sola vez para que la página use la versión corregida.
    let recargado = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (recargado) return;
      recargado = true;
      window.location.reload();
    });
  }, []);

  return null;
}
