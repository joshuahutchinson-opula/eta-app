// public/sw.js — ETA service worker.
// Registered on demand (not on every page load): when a user turns on live
// alerts (B4) or books a trip (B2). It does two jobs:
//   1. Web push: show time-sensitive alerts and open the right screen on tap.
//   2. Offline trips: keep the booked trip's screens, data and photos
//      available when the connection drops mid-trip.
//   3. Offline account screens: My Bookings, Saved and receipts (the page
//      shells and photos; their data is kept per account in localStorage by
//      lib/offline.ts, since API calls carry a bearer token). Cleared on
//      log-out (CLEAR_USER).
// Everything else passes straight through to the network.

const TRIP_CACHE = 'eta-trip-v1'
const USER_CACHE = 'eta-user-v1'
const STATIC_CACHE = 'eta-static-v1'
const STATIC_LIMIT = 200

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = [TRIP_CACHE, USER_CACHE, STATIC_CACHE]
    for (const key of await caches.keys()) {
      if (!keep.includes(key)) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

// ---------- Push ----------

self.addEventListener('push', event => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = { title: 'ETA', body: event.data && event.data.text() } }
  const title = data.title || 'ETA'
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    image: data.image,
    tag: data.tag,
    renotify: false,
    data: { url: data.url || '/' }
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus()
        if ('navigate' in client) return client.navigate(url)
        return
      }
    }
    return self.clients.openWindow(url)
  })())
})

// ---------- Offline trips ----------

self.addEventListener('message', event => {
  const msg = event.data || {}
  if (msg.type === 'CACHE_TRIP' && Array.isArray(msg.urls)) {
    event.waitUntil(cacheUrls(msg.urls, TRIP_CACHE))
  } else if (msg.type === 'CLEAR_TRIP') {
    event.waitUntil(caches.delete(TRIP_CACHE))
  } else if (msg.type === 'CACHE_USER' && Array.isArray(msg.urls)) {
    event.waitUntil(cacheUrls(msg.urls, USER_CACHE))
  } else if (msg.type === 'CLEAR_USER') {
    event.waitUntil(caches.delete(USER_CACHE))
  }
})

async function cacheUrls(urls, name) {
  const cache = await caches.open(name)
  await Promise.all(urls.map(async url => {
    try {
      const sameOrigin = new URL(url, self.location.origin).origin === self.location.origin
      // Cross-origin photos (Cloudinary/Unsplash) come back opaque; that's fine for <img>.
      const res = await fetch(url, sameOrigin ? { credentials: 'same-origin' } : { mode: 'no-cors' })
      if (res.ok || res.type === 'opaque') await cache.put(url, res)
    } catch (e) { /* offline or blocked — skip that one */ }
  }))
}

async function trimStatic() {
  const cache = await caches.open(STATIC_CACHE)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - STATIC_LIMIT; i++) await cache.delete(keys[i])
}

function isTripPage(url) {
  return url.pathname === '/experiences' || url.pathname.startsWith('/trip/')
}

function isUserPage(url) {
  return url.pathname === '/bookings' || url.pathname === '/saved' || url.pathname.startsWith('/receipt/')
}

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const sameOrigin = url.origin === self.location.origin

  // App code chunks: network first, keep a copy so trip screens can boot offline.
  if (sameOrigin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req)
        if (res.ok) {
          const cache = await caches.open(STATIC_CACHE)
          cache.put(req, res.clone()).then(trimStatic)
        }
        return res
      } catch (e) {
        const hit = await caches.match(req)
        if (hit) return hit
        throw e
      }
    })())
    return
  }

  // Trip screens and trip data: network first, cached copy when offline.
  if ((req.mode === 'navigate' && sameOrigin && isTripPage(url)) || (sameOrigin && url.pathname.startsWith('/api/trips/'))) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req)
        if (res.ok) {
          const cache = await caches.open(TRIP_CACHE)
          if (await cache.match(req, { ignoreSearch: req.mode === 'navigate' })) cache.put(req, res.clone())
        }
        return res
      } catch (e) {
        const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' })
        if (hit) return hit
        throw e
      }
    })())
    return
  }

  // My Bookings, Saved and receipts: network first, cached copy when offline.
  if (req.mode === 'navigate' && sameOrigin && isUserPage(url)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req)
        if (res.ok) {
          const cache = await caches.open(USER_CACHE)
          if (await cache.match(req, { ignoreSearch: true })) cache.put(req, res.clone())
        }
        return res
      } catch (e) {
        const hit = await caches.match(req, { ignoreSearch: true })
        if (hit) return hit
        throw e
      }
    })())
    return
  }

  // Photos saved with a booked trip, a booking or a saved place. Network
  // first so sizes stay right; offline, a kept copy of the same photo at
  // another size (Unsplash sizes differ only in the query) still shows.
  if (req.destination === 'image') {
    event.respondWith((async () => {
      const exact = (await caches.open(TRIP_CACHE).then(c => c.match(req.url))) || (await caches.open(USER_CACHE).then(c => c.match(req.url)))
      if (exact) return exact
      try {
        return await fetch(req)
      } catch (e) {
        const near = (await caches.open(TRIP_CACHE).then(c => c.match(req.url, { ignoreSearch: true }))) || (await caches.open(USER_CACHE).then(c => c.match(req.url, { ignoreSearch: true })))
        if (near) return near
        throw e
      }
    })())
  }
})
