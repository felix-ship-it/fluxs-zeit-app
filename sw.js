/**
 * FLUXS Zeit App — Service Worker
 * Cache-first for static assets, network-first for API/CGI.
 * Handles offline queue sync on reconnect.
 */

const CACHE_NAME = 'fluxs-zeit-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  // Core modules
  './core/app.js',
  './core/state.js',
  './core/router.js',
  './core/storage.js',
  './core/api.js',
  './core/auth.js',
  './core/ui.js',
  './core/env.js',
  // Styles
  './styles/variables.css',
  './styles/reset.css',
  './styles/typography.css',
  './styles/layout.css',
  './styles/utilities.css',
  // Fonts
  './assets/fonts/Adonis-Regular.woff2',
  './assets/fonts/Adonis-Bold.woff2',
  './assets/fonts/Moderat-Mono-Medium.woff2',
  './assets/fonts/ModeratMono-Extrabold.woff2',
  // Logo
  './assets/logo/fluxs-lime.svg',
  './assets/logo/fluxs-dark.svg',
  // Icons
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
];

// ─── Install ────────────────────────────────────────────────────────────────

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // CGI/API calls: network-first
  if (url.pathname.includes('/cgi-bin/')) {
    e.respondWith(
      fetch(e.request).catch(() => {
        return new Response(
          JSON.stringify({ success: false, error: 'offline' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // Screen modules: stale-while-revalidate
  if (url.pathname.includes('/screens/')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(e.request);
        const fetchPromise = fetch(e.request).then(resp => {
          if (resp.ok) cache.put(e.request, resp.clone());
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Static assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});