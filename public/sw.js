// Service worker for the installed PWA shell.
//
// Two rules only (see docs/superpowers/specs/2026-11-10-pwa-install-design.md §6.4):
//   - navigation requests (index.html): network-first, cache fallback —
//     online always gets the latest deploy; offline gets the last-cached shell.
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
      await cache.addAll(SHELL_URLS);
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
    event.respondWith(fetch(req).catch(() => caches.match('./')));
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
