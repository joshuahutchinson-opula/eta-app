// lib/offline.ts — offline copies of the things you need without signal:
// saved places, My Bookings (tickets and their QR codes) and receipts.
// Data goes to localStorage (per account; cleared on log-out) and the
// screens' code and photos go to the service worker's user cache (see
// public/sw.js, CACHE_USER), alongside the active-trip cache.
'use client'

import { registerServiceWorker } from '@/lib/alerts-client'

const PREFIX = 'eta_offline_'

export function saveOffline<T>(key: string, data: T) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ data, savedAt: new Date().toISOString() })) } catch {}
}

export function readOffline<T>(key: string): { data: T; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** Keep receipts on the device so they open without signal (newest first, capped). */
export async function saveReceiptsOffline(ids: string[], headers: HeadersInit, limit = 20) {
  for (const id of ids.slice(0, limit)) {
    if (readOffline(`receipt_${id}`)) continue
    try {
      const res = await fetch(`/api/transactions/${id}`, { headers })
      if (res.ok) saveOffline(`receipt_${id}`, await res.json())
    } catch { return }
  }
}

/** Ask the service worker to keep these pages and images. */
export async function cacheForOffline(urls: Array<string | null | undefined>) {
  const list = Array.from(new Set(urls.filter((u): u is string => Boolean(u))))
  if (!list.length || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const reg = await registerServiceWorker()
  const worker = reg?.active ?? navigator.serviceWorker.controller
  if (!worker) return
  // The code this screen runs on, so it can boot offline too.
  const assets = performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin) && u.includes('/_next/static/'))
  worker.postMessage({ type: 'CACHE_USER', urls: [...list, ...assets] })
}
