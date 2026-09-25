// lib/routing.ts — real travel time between two stops.
// Walking and driving durations come from OSRM (the public demo servers by
// default; point OSRM_DRIVING_URL / OSRM_FOOT_URL at a self-hosted instance
// for production traffic). If OSRM is slow or unreachable, or for boat legs,
// fall back to a straight-line estimate so a route is never blocked on it.

export type TransportMode = 'WALKING' | 'TAXI' | 'BOAT'

export interface LatLng { lat: number; lng: number }

export interface Leg {
  mode: TransportMode
  minutes: number
  km: number
  source: 'osrm' | 'estimate'
}

// The project-osrm.org demo only serves the car profile; FOSSGIS hosts a foot profile.
const DRIVING_URL = process.env.OSRM_DRIVING_URL || 'https://router.project-osrm.org/route/v1/driving'
const FOOT_URL = process.env.OSRM_FOOT_URL || 'https://routing.openstreetmap.de/routed-foot/route/v1/foot'
const TIMEOUT_MS = 4000

/** Beyond this, nobody's walking between stops. */
export const MAX_WALK_KM = 1.5

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/** Straight-line fallback with a road-detour factor; taxis include a few minutes to flag one down. */
export function estimateMinutes(km: number, mode: TransportMode): number {
  const road = km * 1.3
  if (mode === 'WALKING') return Math.max(2, Math.round(road / 4.8 * 60))
  if (mode === 'BOAT') return Math.max(10, Math.round(km / 25 * 60) + 10)
  return Math.max(5, Math.round(road / 35 * 60) + 5)
}

const cache = new Map<string, { minutes: number; km: number }>()

async function osrm(url: string, a: LatLng, b: LatLng): Promise<{ minutes: number; km: number } | null> {
  const key = `${url}|${a.lat.toFixed(5)},${a.lng.toFixed(5)}|${b.lat.toFixed(5)},${b.lng.toFixed(5)}`
  const hit = cache.get(key)
  if (hit) return hit
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${url}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'eta-app (experience generator)' }
    })
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    if (data?.code !== 'Ok' || !route) return null
    const result = { minutes: Math.max(1, Math.round(route.duration / 60)), km: route.distance / 1000 }
    // A route many times longer than the straight line means a point snapped to
    // the wrong road (loose vendor coordinates); the estimate is closer to true.
    if (result.km > haversineKm(a, b) * 4 + 1) return null
    cache.set(key, result)
    return result
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Travel between two stops. Picks the mode unless one is given: walk when it's
 * close (or the traveler asked to walk and it's still walkable), otherwise taxi.
 * Boat legs are always estimated — OSRM doesn't route over water.
 */
export async function legBetween(a: LatLng, b: LatLng, opts: { mode?: TransportMode; preferWalking?: boolean } = {}): Promise<Leg> {
  const km = haversineKm(a, b)
  const mode: TransportMode = opts.mode ?? (km <= (opts.preferWalking ? MAX_WALK_KM : 0.8) ? 'WALKING' : 'TAXI')
  if (mode === 'BOAT') return { mode, minutes: estimateMinutes(km, mode), km, source: 'estimate' }
  if (km < 0.05) return { mode: 'WALKING', minutes: 1, km, source: 'estimate' }
  const routed = await osrm(mode === 'WALKING' ? FOOT_URL : DRIVING_URL, a, b)
  if (routed) {
    // OSRM's car profile has no pickup time; add the same few minutes the estimate does.
    return { mode, minutes: mode === 'TAXI' ? routed.minutes + 5 : routed.minutes, km: routed.km, source: 'osrm' }
  }
  return { mode, minutes: estimateMinutes(km, mode), km, source: 'estimate' }
}
