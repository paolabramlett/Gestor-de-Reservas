// Service worker mínimo, sin caché ni soporte offline.
// Existe únicamente para que Chrome/Android reconozcan el sitio como
// "instalable" (criterio de PWA).
//
// A propósito NO llamamos event.respondWith() en "fetch": interceptar
// requests (incluyendo navegaciones) es una causa conocida de fallas en
// cadenas de redirects (ej. login -> aceptar invitación -> panel), sobre
// todo en navegadores embebidos como el de Gmail o en iOS Safari. Dejamos
// que el navegador maneje cada request de forma nativa; el listener solo
// existe para que el sitio cuente como "instalable".
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intencionalmente vacío — sin respondWith, sin caché.
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
