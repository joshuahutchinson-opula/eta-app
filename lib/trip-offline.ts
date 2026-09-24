// lib/trip-offline.ts
// Offline mode for active trips (B2). When a trip is booked, its full data
// (stops, crew, vendor details, coordinates) is written to localStorage and
// the service worker caches the Experiences screen, the app code it runs
// on, the trip API response and every stop photo. Mid-trip with no signal,
// /experiences reopens straight into the saved trip.
'use client'

import { useEffect, useState } from 'react'
import { registerServiceWorker } from '@/lib/alerts-client'
import type { TripView } from '@/lib/trip-client'

const ACTIVE_KEY = 'eta_active_trip'
const cacheKey = (slug: string) => `eta_trip_cache_${slug}`

export async function cacheTripForOffline(trip: TripView): Promise<void> {
  try {
    localStorage.setItem(cacheKey(trip.slug), JSON.stringify({ trip, savedAt: new Date().toISOString() }))
    localStorage.setItem(ACTIVE_KEY, trip.slug)
  } catch {
    return // storage full or blocked; the online experience is unaffected
  }
  const reg = await registerServiceWorker()
  const worker = reg?.active ?? navigator.serviceWorker?.controller
  if (!worker) return
  // The code this screen is running right now, so it can boot offline.
  const assets = performance.getEntriesByType('resource')
    .map(e => e.name)
    .filter(u => u.startsWith(window.location.origin) && u.includes('/_next/static/'))
  const images = [trip.experience?.imageUrl, ...trip.stops.map(s => s.image)].filter((u): u is string => Boolean(u))
  worker.postMessage({
    type: 'CACHE_TRIP',
    urls: Array.from(new Set(['/experiences', `/api/trips/${trip.slug}`, '/logo-tb.png', ...assets, ...images]))
  })
}

export function getCachedTrip(slug: string): { trip: TripView; savedAt: string } | null {
  try {
    const raw = localStorage.getItem(cacheKey(slug))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getActiveCachedTrip(): { trip: TripView; savedAt: string } | null {
  try {
    const slug = localStorage.getItem(ACTIVE_KEY)
    const cached = slug ? getCachedTrip(slug) : null
    return cached && cached.trip.status === 'BOOKED' ? cached : null
  } catch {
    return null
  }
}

/** Keeps the saved copy current while online (payments, crew statuses). */
export function updateCachedTrip(trip: TripView) {
  try {
    if (localStorage.getItem(cacheKey(trip.slug))) {
      localStorage.setItem(cacheKey(trip.slug), JSON.stringify({ trip, savedAt: new Date().toISOString() }))
    }
  } catch {}
}

export function clearTripCache(slug: string) {
  try {
    localStorage.removeItem(cacheKey(slug))
    if (localStorage.getItem(ACTIVE_KEY) === slug) localStorage.removeItem(ACTIVE_KEY)
  } catch {}
  navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_TRIP' })
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
