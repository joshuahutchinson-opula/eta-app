// lib/stage-actions.ts — what happens when the traveler confirms a stage
// switch (lib/stage.ts prompts): starting the trip (→ the arrival flow, or
// straight to the trip for a local's getaway), ending it, extending it or
// shifting the dates to when they really arrived. Nothing here runs without
// a tap.
'use client'

import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { cacheArrival, cachedArrival, handToArrival, type ArrivalRide, type TripArrivalPayload } from '@/lib/arrival-client'
import { addTrip, updateTrip, type TripView } from '@/lib/stage-client'
import { AIRPORTS, nearestAirport } from '@/lib/places-geo'
import { addDays, jamaicaDayKey } from '@/lib/trip-dates'
import { townFor, type CityCode } from '@/lib/regions'
import type { WelcomeReward } from '@/lib/welcome'

/** What the arrival flow needs for this trip; cached for the airport. */
export async function buildTripArrival(trip: TripView): Promise<TripArrivalPayload> {
  const cached = cachedArrival(trip.id)
  if (typeof navigator !== 'undefined' && !navigator.onLine && cached) return cached
  const town = townFor(trip.stayCity ?? trip.city)
  const from = trip.stayLat !== null && trip.stayLng !== null ? { lat: trip.stayLat, lng: trip.stayLng } : town
  const airport = AIRPORTS.find(a => a.code === trip.arrivalAirport) ?? nearestAirport(from)
  const onAccount = Boolean(getCurrentUser()) && !trip.local
  const returning = Boolean(trip.returning)
  const [reward, ride] = await Promise.all([
    (returning && onAccount
      ? apiJson<{ reward: WelcomeReward | null }>(`/api/travel-trips/${trip.id}/welcome-back`).then(r => r.reward).catch(() => null)
      : Promise.resolve(null)
    ).then(r => r ?? fetch(`/api/welcome?city=${trip.city}`).then(res => (res.ok ? res.json() : { reward: null })).then(d => d.reward ?? null).catch(() => null)),
    onAccount ? apiJson<{ ride: ArrivalRide | null }>(`/api/travel-trips/${trip.id}/ride`).then(r => r.ride).catch(() => null) : Promise.resolve(null)
  ])
  const payload: TripArrivalPayload = {
    place: { kind: 'airport', name: airport.name, city: (trip.stayCity ?? trip.city) as CityCode, airport: airport.code, lat: airport.lat, lng: airport.lng },
    city: trip.stayCity ?? trip.city,
    reward,
    trip: {
      tripId: trip.id,
      kind: trip.kind,
      returning,
      stay: trip.stayName ? { name: trip.stayName, city: trip.stayCity ?? trip.city, lat: trip.stayLat, lng: trip.stayLng, partnerCode: trip.partnerCode } : null,
      ride,
      end: trip.end
    }
  }
  return payload
}

/** During the countdown: keep the arrival ready for the airport (offline there). */
export async function prepareArrival(trip: TripView) {
  if (trip.kind === 'GETAWAY') return
  try { await cacheArrival(await buildTripArrival(trip)) } catch {}
}

/**
 * "I've landed" / at the airport: the trip goes on (status ACTIVE) and the
 * arrival flow takes over. A local's getaway starts without arrival screens.
 * Returns where to go next.
 */
export async function startTrip(trip: TripView, opts: { shiftToToday?: boolean } = {}): Promise<string> {
  const today = jamaicaDayKey()
  const shift = opts.shiftToToday && trip.start !== today
  const nights = Math.round((Date.parse(trip.end) - Date.parse(trip.start)) / 86400000)
  const patch = shift ? { status: 'ACTIVE' as const, start: today, end: addDays(today, Math.max(0, nights)) } : { status: 'ACTIVE' as const }
  const payload = trip.kind === 'GETAWAY' ? null : await buildTripArrival(trip).catch(() => cachedArrival(trip.id))
  await updateTrip(trip.id, patch).catch(() => {})
  if (!payload) return '/'
  handToArrival(payload)
  return '/arrival'
}

/** "Looks like you're in Jamaica! Starting your trip?" → Yes: a trip from today; the arrival asks the leave date. */
export async function startTripToday(city: CityCode): Promise<string> {
  const today = jamaicaDayKey()
  const trip = await addTrip({ city, start: today, end: addDays(today, 6), status: 'ACTIVE' })
  const payload = await buildTripArrival(trip)
  handToArrival({ ...payload, trip: payload.trip ? { ...payload.trip, end: null } : undefined })
  return '/arrival'
}

export function endTrip(trip: TripView, early: boolean) {
  const today = jamaicaDayKey()
  return updateTrip(trip.id, { status: 'ENDED', ...(early && today < trip.end ? { end: today < trip.start ? trip.start : today } : {}) })
}

export function extendTrip(trip: TripView, days: number) {
  const today = jamaicaDayKey()
  const base = trip.end < today ? today : trip.end
  return updateTrip(trip.id, { end: addDays(base, days) })
}

/** Arrived earlier or later than planned: move the whole trip by that many days. */
export function shiftTrip(trip: TripView, days: number) {
  return updateTrip(trip.id, { start: addDays(trip.start, days), end: addDays(trip.end, days), legs: trip.legs.map(l => ({ ...l, start: addDays(l.start, days), end: addDays(l.end, days) })) })
}
