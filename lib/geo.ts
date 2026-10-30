// lib/geo.ts — the user's position and distances for cards and sorting.
'use client'

import { useEffect, useState } from 'react'
import { haversineKm, type LatLng } from '@/lib/routing'

/** Asks for the user's position once; null until (and unless) they allow it. */
export function useUserLocation(): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 5 * 60 * 1000, timeout: 10000 }
    )
  }, [])
  return pos
}

/** Live position, for the active trip screen. */
export function useWatchedLocation(enabled = true): (LatLng & { accuracy: number }) | null {
  const [pos, setPos] = useState<(LatLng & { accuracy: number }) | null>(null)
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return
    const id = navigator.geolocation.watchPosition(
      p => setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [enabled])
  return pos
}

function hasCoords(p: { lat?: number | null; lng?: number | null }): p is { lat: number; lng: number } {
  return typeof p.lat === 'number' && typeof p.lng === 'number' && !(p.lat === 0 && p.lng === 0)
}

export function distanceFrom(from: LatLng | null, to: { lat?: number | null; lng?: number | null }): number | null {
  if (!from || !hasCoords(to)) return null
  return haversineKm(from, to)
}

/** Nearest first; anything without coordinates (or no user position) goes last, in its original order. */
export function sortByDistance<T extends { lat?: number | null; lng?: number | null }>(items: T[], from: LatLng | null): T[] {
  return items
    .map((item, i) => ({ item, i, d: distanceFrom(from, item) }))
    .sort((a, b) => (a.d === null ? (b.d === null ? a.i - b.i : 1) : b.d === null ? -1 : a.d - b.d))
    .map(x => x.item)
}

export function formatDistance(km: number | null): string | null {
  if (km === null) return null
  if (km < 1) return `${Math.max(50, Math.round(km * 1000 / 50) * 50)} m`
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
}
