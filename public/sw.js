// EX YU DATE - service worker
// Minimalan service worker samo da bi preglednik dopustio instalaciju kao app.
// Ne sprema ništa u cache - stranica se uvijek učitava svježa s interneta.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Propusti sve zahtjeve direktno na mrežu (bez keširanja)
  event.respondWith(fetch(event.request));
});
