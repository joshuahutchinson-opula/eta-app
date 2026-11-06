// lib/places-geo.ts — fixed places the app reacts to, shared by the server
// and the app (no database): Jamaica's airports, its cruise ports and a
// rough box around the island. The arrival moment (lib/arrival.ts), the trip
// stages (lib/stage.ts) and transfers (lib/transfers.ts) all read these.
import { haversineKm, type LatLng } from '@/lib/routing'
import type { CityCode } from '@/lib/regions'

/** Airports, with the town most arrivals there head for. */
export const AIRPORTS: Array<{ code: string; name: string; lat: number; lng: number; city: CityCode }> = [
  { code: 'MBJ', name: 'Sangster International (MBJ)', lat: 18.5037, lng: -77.9134, city: 'MONTEGO_BAY' },
  { code: 'KIN', name: 'Norman Manley International (KIN)', lat: 17.9357, lng: -76.7875, city: 'KINGSTON' },
  { code: 'OCJ', name: 'Ian Fleming International (OCJ)', lat: 18.4047, lng: -76.9690, city: 'ORACABESSA' },
  { code: 'NEG', name: 'Negril Aerodrome', lat: 18.3428, lng: -78.3356, city: 'NEGRIL' }
]

/** Cruise ship terminals: a day ashore, back on board by the all-aboard time. */
export const CRUISE_PORTS: Array<{ city: CityCode; name: string; lat: number; lng: number }> = [
  { city: 'OCHO_RIOS', name: 'Ocho Rios Cruise Port', lat: 18.4115, lng: -77.1105 },
  { city: 'FALMOUTH', name: 'Falmouth Cruise Port', lat: 18.4959, lng: -77.6556 },
  { city: 'MONTEGO_BAY', name: 'Montego Bay Cruise Port', lat: 18.4884, lng: -77.9373 }
]

export const AIRPORT_RADIUS_M = 2500
export const CRUISE_PORT_RADIUS_M = 1200

/** Rough box around the island; anything outside is "not in Jamaica". */
export function inJamaica(p: LatLng): boolean {
  return p.lat > 17.6 && p.lat < 18.6 && p.lng > -78.5 && p.lng < -76.1
}

export function airportAt(p: LatLng | null) {
  if (!p) return null
  return AIRPORTS.find(a => haversineKm(p, a) * 1000 <= AIRPORT_RADIUS_M) ?? null
}

export function cruisePortAt(p: LatLng | null) {
  if (!p) return null
  return CRUISE_PORTS.find(c => haversineKm(p, c) * 1000 <= CRUISE_PORT_RADIUS_M) ?? null
}

export function cruisePortFor(city: string | null | undefined) {
  return CRUISE_PORTS.find(c => c.city === city) ?? null
}

/** The airport closest to a place (a stay, a town): where the ride from the airport starts. */
export function nearestAirport(p: LatLng) {
  return AIRPORTS.filter(a => a.code !== 'NEG').reduce((best, a) => (haversineKm(p, a) < haversineKm(p, best) ? a : best), AIRPORTS[0])
}
