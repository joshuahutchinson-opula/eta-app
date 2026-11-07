// lib/stage.ts — trip stages: one Home, different states. Pure (no React,
// no database), so the app and the server agree on it.
//
//   guest      not signed up: normal Home + "Sign up to save and earn points"
//   local      "I live in Jamaica": normal Home for their town
//   browsing   a visitor without dates: "Planning a trip? Add your dates"
//   countdown  an upcoming trip: "<n> Days To <Town>", ride, gift, what's on
//   arrival    landed: the arrival flow (app/arrival), skipping what's done
//   trip       on the trip: Home with the trip-day chip
//   between    back home after a trip: "Welcome Back", Your Last Trip
//   cruise     a day ashore from a cruise ship: "All aboard in <h m>"
//
// The stage comes from the dates, the trips' status and where the phone is,
// but big switches are never made silently: they come back as prompts the
// traveler confirms (stageFor().prompts), and nothing ends without a tap.
// Rules: browsing works without an account or a trip; details are asked
// for only when they're needed.
import { addDays, jamaicaDayKey, tripProgress } from '@/lib/trip-dates'
import { airportAt, cruisePortAt, inJamaica } from '@/lib/places-geo'
import { haversineKm, type LatLng } from '@/lib/routing'
import { nearestTown, type CityCode } from '@/lib/regions'

export type Stage = 'guest' | 'local' | 'browsing' | 'countdown' | 'arrival' | 'trip' | 'between' | 'cruise'
export type TravelerType = 'LOCAL' | 'VISITOR'

export interface TripLeg { city: CityCode; start: string; end: string }

/** A trip as the app sees it (from /api/travel-trips, or the device for guests). */
export interface TripLite {
  id: string
  kind: 'VISIT' | 'GETAWAY'
  status: 'UPCOMING' | 'ACTIVE' | 'ENDED' | 'CANCELLED'
  city: CityCode
  /** Jamaica days, YYYY-MM-DD. */
  start: string
  end: string
  legs: TripLeg[]
  stayName: string | null
  stayCity: CityCode | null
  stayLat: number | null
  stayLng: number | null
  stayAccommodationId: string | null
  partnerCode: string | null
  arrivalAirport: string | null
  arrivedAt: string | null
  /** Group trips: everyone on it (first names + avatars). */
  members: Array<{ id: string; name: string; avatarUrl: string | null }>
  inviteCode: string | null
  /** Set on the server: is this a returning traveler, and have they been to this town? */
  returning?: boolean
  visitedTown?: boolean
  /** Device-only trip (guest), not yet on an account. */
  local?: boolean
}

export interface CruiseDay { port: CityCode; day: string; allAboardAt: string }

export type PromptKind =
  | 'arrival'        // in Jamaica / at the airport on (or near) the arrival day: start the trip?
  | 'arrivingToday'  // arrival day, phone not in Jamaica yet: "Arriving today" (wait)
  | 'landed'         // arrival day, location off: "Landed?"
  | 'startGetaway'   // a local's getaway starts today
  | 'shiftDates'     // arrived earlier/later than the dates
  | 'extend'         // still in Jamaica after the leave date
  | 'endEarly'       // out of Jamaica before the leave date
  | 'dayTrip'        // in another town during the day
  | 'goingTo'        // between trips, location set to another town: "Going to <Town>?"
  | 'cruise'         // at a cruise port: set the all-aboard time

export interface Prompt { kind: PromptKind; tripId?: string; city?: CityCode; days?: number }

export interface StageInput {
  signedIn: boolean
  travelerType: TravelerType | null
  trips: TripLite[]
  /** The phone's position; null when unknown or location is off. */
  position: LatLng | null
  /** The town picked in the location pill. */
  regionCity: CityCode
  cruise: CruiseDay | null
  /** Prompt keys (kind:tripId) the traveler waved away, with when that runs out (ms). */
  dismissed: Record<string, number>
  now?: Date
}

export interface StageResult {
  stage: Stage
  /** The trip the stage is about: the active one, the nearest upcoming one, or the last one. */
  trip: TripLite | null
  /** The current leg's town while on the trip. */
  legCity: CityCode | null
  /** 1-based day of the trip and its length, while on it. */
  day: { n: number; total: number } | null
  /** Days until the nearest upcoming trip. */
  daysUntil: number | null
  prompts: Prompt[]
  guest: boolean
}

export const promptKey = (p: Prompt) => `${p.kind}:${p.tripId ?? p.city ?? ''}`

/** The trip's leg for a day (falls back to the trip's town). */
export function legFor(trip: TripLite, day: string): TripLeg {
  const legs = trip.legs.length ? trip.legs : [{ city: trip.city, start: trip.start, end: trip.end }]
  return legs.find(l => day >= l.start && day <= l.end) ?? (day < legs[0].start ? legs[0] : legs[legs.length - 1])
}

const live = (t: TripLite) => t.status !== 'CANCELLED'

export function stageFor(input: StageInput): StageResult {
  const now = input.now ?? new Date()
  const today = jamaicaDayKey(now)
  const pos = input.position
  const inJa = pos ? inJamaica(pos) : null
  const airport = airportAt(pos)
  const trips = input.trips.filter(live)
  const prompts: Prompt[] = []
  const guest = !input.signedIn
  const isLocal = input.travelerType === 'LOCAL'
  const off = (p: Prompt) => (input.dismissed[promptKey(p)] ?? 0) > now.getTime()
  const ask = (p: Prompt) => { if (!off(p)) prompts.push(p) }
  const base = { legCity: null, day: null, daysUntil: null, guest }

  // A day ashore from a cruise ship, until an hour after all aboard.
  if (input.cruise && input.cruise.day === today && Date.parse(input.cruise.allAboardAt) > now.getTime() - 3600000) {
    return { ...base, stage: 'cruise', trip: null, legCity: input.cruise.port, prompts }
  }

  const active = trips.filter(t => t.status === 'ACTIVE').sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
  if (active) {
    const p = tripProgress(active.start, active.end, now)
    const leg = legFor(active, today)
    if (p.phase === 'after') {
      // The day after the leave date: still here? Otherwise the trip's done.
      if (inJa) {
        ask({ kind: 'extend', tripId: active.id })
        return { ...base, stage: 'trip', trip: active, legCity: leg.city, day: { n: p.total, total: p.total }, prompts }
      }
      return { ...base, stage: 'between', trip: { ...active, status: 'ENDED' }, prompts }
    }
    if (inJa === false && p.phase === 'during' && today < active.end && active.kind === 'VISIT') ask({ kind: 'endEarly', tripId: active.id })
    if (active.arrivedAt) {
      const arrivedDay = jamaicaDayKey(new Date(active.arrivedAt))
      if (arrivedDay !== active.start) ask({ kind: 'shiftDates', tripId: active.id, days: Math.round((Date.parse(arrivedDay) - Date.parse(active.start)) / 86400000) })
    }
    // In another town during the day: explore it for the day?
    if (pos && inJa) {
      const here = nearestTown(pos)
      if (here.city !== leg.city && haversineKm(pos, here) < 12 && now.getUTCHours() >= 12 && now.getUTCHours() < 23) ask({ kind: 'dayTrip', city: here.city })
    }
    return { ...base, stage: 'trip', trip: active, legCity: leg.city, day: { n: p.phase === 'during' ? p.day : 1, total: p.total }, prompts }
  }

  const upcoming = trips
    .filter(t => t.status === 'UPCOMING' && t.end >= today)
    .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
  if (upcoming) {
    const p = tripProgress(upcoming.start, upcoming.end, now)
    const arrivalDay = p.phase !== 'before'
    if (upcoming.kind === 'GETAWAY') {
      if (arrivalDay) ask({ kind: 'startGetaway', tripId: upcoming.id })
    } else if (airport && today >= addDays(upcoming.start, -3)) {
      // At the airport: straight away, even a little early (offer to shift the dates).
      ask({ kind: 'arrival', tripId: upcoming.id })
    } else if (arrivalDay) {
      if (inJa) ask({ kind: 'arrival', tripId: upcoming.id })
      else if (inJa === false) ask({ kind: 'arrivingToday', tripId: upcoming.id })
      else ask({ kind: 'landed', tripId: upcoming.id })
    }
    return { ...base, stage: 'countdown', trip: upcoming, daysUntil: p.phase === 'before' ? p.daysUntil : 0, prompts }
  }

  // No trip on. At a cruise port: a cruise day?
  const port = cruisePortAt(pos)
  if (port && !isLocal) ask({ kind: 'cruise', city: port.city })

  if (isLocal) return { ...base, stage: 'local', trip: null, prompts }
  const last = trips
    .filter(t => t.status === 'ENDED' || (t.status === 'ACTIVE' && t.end < today))
    .sort((a, b) => b.end.localeCompare(a.end))[0] ?? null
  if (last) {
    if (input.regionCity !== last.city && !inJa) ask({ kind: 'goingTo', city: input.regionCity })
    return { ...base, stage: 'between', trip: last, prompts }
  }
  if (guest && !input.travelerType) return { ...base, stage: 'guest', trip: null, prompts }
  return { ...base, stage: 'browsing', trip: null, prompts }
}

/** "8 Days To Negril" maths: days, hours, minutes and seconds until the arrival day starts. */
export function countdownParts(start: string, now = Date.now()) {
  const target = Date.parse(`${start}T00:00:00-05:00`)
  const ms = Math.max(0, target - now)
  return {
    done: ms === 0,
    days: Math.floor(ms / 86400000),
    hours: Math.floor(ms / 3600000) % 24,
    minutes: Math.floor(ms / 60000) % 60,
    seconds: Math.floor(ms / 1000) % 60
  }
}
