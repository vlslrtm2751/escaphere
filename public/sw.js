// Service worker for the installed PWA shell.
//
// Two rules only (see docs/superpowers/specs/2026-11-10-pwa-install-design.md §6.4):
//   - navigation requests (index.html): network-first, cache fallback —
//     online always gets the latest deploy, and that same successful response
//     also refreshes the cached shell, so the next offline launch shows the
//     version from the last time you connected; offline falls back to that
//     cached shell.
//   - everything else: cache-first — safe because the JS bundle's filename
//     carries a content hash, so a new deploy is simply a cache MISS at a
//     new URL, never a stale HIT at an old one.
const CACHE_NAME = 'escaphere-shell-v1';

// Paths with no build-time hash, known ahead of time.
const SHELL_URLS = [
  './',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Per-URL rather than cache.addAll, which is atomic: one 404 there
      // fails the whole install, so the worker never activates and the app
      // silently loses both offline support and (since Chrome requires an
      // active fetch-handling worker) the install prompt. A genuinely
      // missing file is caught loudly at build time instead, by the
      // existence check in scripts/inject-pwa-tags.js.
      await Promise.all(SHELL_URLS.map((u) => cache.add(u).catch(() => {})));
      // The JS bundle's filename is content-hashed per build, so sw.js (a
      // static file with no build step of its own) can't know it ahead of
      // time. Discover it at install time by reading the page we were
      // registered from. A parse failure here must not fail install -- the
      // bundle still gets cached on first real fetch via the fetch handler
      // below, just not pre-warmed for an immediate offline-after-install.
      try {
        const html = await (await fetch('./')).text();
        const match = html.match(/<script src="([^"]+)" defer><\/script>/);
        if (match) await cache.add(match[1]);
      } catch {}
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.mode === 'navigate') {
    event.respondWith(
      // cache: 'no-store' keeps a cold launch from being satisfied by the
      // HTTP cache within GitHub Pages' max-age window rather than genuinely
      // reaching the network. req.url rather than new Request(req, ...)
      // because the Request constructor coerces mode 'navigate' to 'same-origin'.
      fetch(req.url, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            // Key on './', not req -- the fallback below looks up './', and a
            // launch with a query string must not write a key it can't find.
            caches.open(CACHE_NAME).then((c) => c.put('./', copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match('./').then((r) => r || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
    )
  );
});
