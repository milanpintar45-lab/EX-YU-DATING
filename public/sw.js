// EX YU DATE - service worker
// Minimalan service worker samo da bi preglednik
// dopustio instalaciju kao app.
// Ne sprema ništa u cache - stranica se uvijek
// učitava svježa s interneta, i eksplicitno zaobilazi
// preglednikov vlastiti spremljeni (HTTP cache) zapis.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Ukloni bilo koji stari "Cache Storage" spremnik ako postoji
      // od neke ranije verzije ovog service workera
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // Propusti sve zahtjeve direktno na mrežu (bez keširanja) i
  // eksplicitno zatraži od preglednika da zaobiđe svoj vlastiti
  // HTTP cache (cache: 'no-store') - inače preglednik ponekad
  // sam odluči vratiti staru spremljenu verziju umjesto da pita mrežu.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).catch(() => fetch(event.request))
  );
});
