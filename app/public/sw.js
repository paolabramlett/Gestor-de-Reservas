// Service worker mínimo, sin caché ni soporte offline.
// Existe únicamente para que Chrome/Android reconozcan el sitio como
// "instalable" (criterio de PWA). Cada fetch pasa directo a la red.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
