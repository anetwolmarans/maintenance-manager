/* Minimal service worker – makes the app installable and offline-capable.
 * Network-first for pages, cache-first for static assets.
 * Scope-aware so it works at the GitHub Pages sub-path, on localhost and
 * inside the Capacitor APK. */
const CACHE = 'maint-app-v2'
// e.g. '/maintenance-manager/' on GitHub Pages, '/' locally / in the APK
const BASE = new URL(self.registration.scope).pathname

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // remove caches left over from previous app versions
      const names = await caches.keys()
      await Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      await clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // static build assets: cache-first
  if (url.pathname.includes('/_next/static') || url.pathname.startsWith(BASE + 'icons')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(event.request)
        if (hit) return hit
        const res = await fetch(event.request)
        if (res.ok) cache.put(event.request, res.clone())
        return res
      }).catch(() => fetch(event.request)),
    )
    return
  }

  // everything else: network-first (fresh content), fall back to cache when offline
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && event.request.headers.get('accept')?.includes('text/html')) {
          caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()))
        }
        return res
      })
      .catch(() =>
        caches.match(event.request).then((hit) => hit || caches.match(BASE)).then((hit) => hit || caches.match(BASE + 'index.html')),
      ),
  )
})
