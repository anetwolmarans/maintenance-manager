/* Minimal service worker – makes the app installable on Android/tablets.
 * Network-first for pages and API, cache-first for static assets. */
const CACHE = 'maint-app-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return

  // static build assets: cache-first
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons')) {
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

  // everything else: network-first (fresh data), fall back to cache when offline
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && event.request.headers.get('accept')?.includes('text/html')) {
          caches.open(CACHE).then((cache) => cache.put(event.request, res.clone()))
        }
        return res
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('/'))),
  )
})
