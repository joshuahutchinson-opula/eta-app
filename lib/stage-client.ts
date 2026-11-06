// lib/stage-client.ts — trip stages in the app (lib/stage.ts does the
// deciding). Where things live:
//   signed in   trips on the account (/api/travel-trips), cached on the
//               device for offline; traveler type and cruise day on the user
//   guest       everything on the device (eta_stage), merged into the
//               account on sign-up (syncStageToAccount, run by SessionGuard)
// Also keeps the older trip-mode copy (lib/trip-mode.ts, eta_trip) in step
// with the current trip, so the trip-day chip, Experiences' day strip and
// the recap keep working.
'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiJson } from '@/lib/api-client'
import { AUTH_EVENT, getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { useRegion } from '@/components/RegionProvider'
import { useUserLocation } from '@/lib/geo'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { isCityCode, type CityCode } from '@/lib/regions'
import { promptKey, stageFor, type CruiseDay, type Prompt, type StageResult, type TravelerType, type TripLite } from '@/lib/stage'

const KEY = 'eta_stage'
const TRIPS_CACHE = 'eta_travel_trips'
const LEGACY_TRIP = 'eta_trip'
export const STAGE_EVENT = 'eta-stage-change'

export interface TripView extends TripLite {
  isOwner?: boolean
  pendingChange?: { id: string; start: string; end: string; proposedBy: string; mine: boolean; approvedByMe: boolean } | null
  welcomeBackClaimed?: boolean
}

interface DeviceStage {
  travelerType: TravelerType | null
  /** Guests' trips (and nothing else once signed in). */
  trips: TripView[]
  dismissed: Record<string, number>
  cruise: CruiseDay | null
  /** "Exploring <Town> today?": the town for the day and the one to go back to at night. */
  dayTrip: { city: CityCode; day: string; back: CityCode } | null
  /** Legs whose town the location pill already moved to. */
  appliedLegs: string[]
}

const EMPTY: DeviceStage = { travelerType: null, trips: [], dismissed: {}, cruise: null, dayTrip: null, appliedLegs: [] }

export function readDevice(): DeviceStage {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return EMPTY }
}

function writeDevice(patch: Partial<DeviceStage>): DeviceStage {
  const next = { ...readDevice(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  window.dispatchEvent(new CustomEvent(STAGE_EVENT))
  return next
}

function readCachedTrips(): { trips: TripView[]; explored: Record<string, number> } {
  try { return { trips: [], explored: {}, ...JSON.parse(localStorage.getItem(TRIPS_CACHE) || '{}') } } catch { return { trips: [], explored: {} } }
}

/** The older single-trip copy, for screens that still read lib/trip-mode. */
function writeLegacy(trip: TripView | null) {
  try {
    const prev = JSON.parse(localStorage.getItem(LEGACY_TRIP) || 'null') ?? {}
    const next = trip
      ? { ...prev, start: trip.start, end: trip.end, stayName: trip.stayName, stayCity: trip.stayCity ?? trip.city, stayAccommodationId: trip.stayAccommodationId, stayLat: trip.stayLat, stayLng: trip.stayLng }
      : { ...prev, start: null, end: null }
    localStorage.setItem(LEGACY_TRIP, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent('eta-trip-change', { detail: { stayName: null, stayCity: null, stayAccommodationId: null, partnerCode: null, ...next } }))
  } catch {}
}

const signedIn = () => Boolean(getCurrentUser())
const localId = () => `local_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

let inflight: Promise<void> | null = null

/** Re-reads the account's trips (signed in) into the device cache. */
export function refreshTrips(): Promise<void> {
  if (!signedIn()) return Promise.resolve()
  if (inflight) return inflight
  inflight = apiJson<{ trips: TripView[]; travelerType: TravelerType | null; cruise: CruiseDay | null; explored: Record<string, number> }>('/api/travel-trips')
    .then(d => {
      try { localStorage.setItem(TRIPS_CACHE, JSON.stringify({ trips: d.trips, explored: d.explored })) } catch {}
      const dev = readDevice()
      writeDevice({ travelerType: d.travelerType ?? dev.travelerType, cruise: d.cruise ? { ...d.cruise, allAboardAt: new Date(d.cruise.allAboardAt).toISOString() } : dev.cruise })
    })
    .catch(() => {})
    .finally(() => { inflight = null })
  return inflight
}

export function allTrips(): TripView[] {
  return signedIn() ? readCachedTrips().trips : readDevice().trips
}

export interface NewTrip {
  kind?: 'VISIT' | 'GETAWAY'
  city: CityCode
  start: string
  end: string
  stayName?: string | null
  stayCity?: CityCode | null
  stayAccommodationId?: string | null
  stayLat?: number | null
  stayLng?: number | null
  arrivalAirport?: string | null
  legs?: Array<{ city: CityCode; start: string; end: string }>
  status?: 'UPCOMING' | 'ACTIVE'
}

export async function addTrip(input: NewTrip): Promise<TripView> {
  if (input.kind !== 'GETAWAY') await setTravelerType('VISITOR')
  if (signedIn()) {
    const { trip } = await apiJson<{ trip: TripView }>('/api/travel-trips', { method: 'POST', body: input })
    await refreshTrips()
    return trip
  }
  const trip: TripView = {
    id: localId(), kind: input.kind ?? 'VISIT', status: input.status ?? 'UPCOMING', city: input.city, start: input.start, end: input.end,
    legs: input.legs ?? [], stayName: input.stayName ?? null, stayCity: input.stayCity ?? null, stayLat: input.stayLat ?? null, stayLng: input.stayLng ?? null,
    stayAccommodationId: input.stayAccommodationId ?? null, partnerCode: null, arrivalAirport: input.arrivalAirport ?? null,
    arrivedAt: input.status === 'ACTIVE' ? new Date().toISOString() : null, members: [], inviteCode: null, local: true
  }
  writeDevice({ trips: [...readDevice().trips, trip] })
  return trip
}

export async function updateTrip(id: string, patch: Omit<Partial<NewTrip>, 'status'> & { status?: 'UPCOMING' | 'ACTIVE' | 'ENDED' }): Promise<{ trip: TripView | null; pending: boolean }> {
  if (signedIn() && !id.startsWith('local_')) {
    const res = await apiJson<{ trip: TripView; pending: boolean }>(`/api/travel-trips/${id}`, { method: 'PATCH', body: patch })
    await refreshTrips()
    return res
  }
  const trips = readDevice().trips.map(t => (t.id === id ? {
    ...t, ...patch,
    legs: patch.legs ?? t.legs,
    arrivedAt: patch.status === 'ACTIVE' ? t.arrivedAt ?? new Date().toISOString() : patch.status === 'UPCOMING' ? null : t.arrivedAt
  } as TripView : t))
  writeDevice({ trips })
  return { trip: trips.find(t => t.id === id) ?? null, pending: false }
}

export async function deleteTrip(id: string): Promise<void> {
  if (signedIn() && !id.startsWith('local_')) {
    await apiJson(`/api/travel-trips/${id}`, { method: 'DELETE' })
    await refreshTrips()
    return
  }
  writeDevice({ trips: readDevice().trips.filter(t => t.id !== id) })
}

export async function answerChange(tripId: string, changeId: string, approve: boolean) {
  await apiJson(`/api/travel-trips/${tripId}/changes/${changeId}`, { method: 'POST', body: { approve } })
  await refreshTrips()
}

export async function setTravelerType(type: TravelerType | null) {
  writeDevice({ travelerType: type })
  const u = getCurrentUser()
  if (u) {
    const { user } = await apiJson<{ user: typeof u }>('/api/users/me', { method: 'PUT', body: { travelerType: type } }).catch(() => ({ user: null }))
    if (user) setCurrentUser(user)
  }
}

export async function setCruise(cruise: CruiseDay | null) {
  writeDevice({ cruise })
  if (signedIn()) await apiJson('/api/users/me', { method: 'PUT', body: { cruisePort: cruise?.port ?? null, cruiseDay: cruise?.day ?? null, cruiseAllAboardAt: cruise?.allAboardAt ?? null } }).catch(() => {})
}

export function dismissPrompt(p: Prompt, forMs: number) {
  const dev = readDevice()
  writeDevice({ dismissed: { ...dev.dismissed, [promptKey(p)]: Date.now() + forMs } })
  // "Not now" on "Starting your trip?" is quiet for 7 days on every device.
  if (p.kind === 'inJamaica' && signedIn()) apiJson('/api/users/me', { method: 'PUT', body: { stagePromptSnoozedUntil: new Date(Date.now() + forMs).toISOString() } }).catch(() => {})
}

export function setDayTrip(v: DeviceStage['dayTrip']) { writeDevice({ dayTrip: v }) }
export function markLegApplied(key: string) { writeDevice({ appliedLegs: [...readDevice().appliedLegs.slice(-20), key] }) }

/**
 * After sign-in or sign-up: the device's trips, traveler type and cruise
 * day move onto the account, and a visit held from a camera scan is
 * credited. Safe to call on every load.
 */
export async function syncStageToAccount(): Promise<void> {
  if (!signedIn()) return
  const dev = readDevice()
  try {
    if (dev.travelerType && !getCurrentUser()?.travelerType) await setTravelerType(dev.travelerType)
    await refreshTrips()
    const onAccount = readCachedTrips().trips
    for (const t of dev.trips.filter(x => x.local && !onAccount.some(a => a.start === x.start && a.end === x.end))) {
      await apiJson('/api/travel-trips', { method: 'POST', body: { kind: t.kind, city: t.city, start: t.start, end: t.end, stayName: t.stayName, stayCity: t.stayCity, stayAccommodationId: t.stayAccommodationId, stayLat: t.stayLat, stayLng: t.stayLng, arrivalAirport: t.arrivalAirport, legs: t.legs, status: t.status === 'ACTIVE' ? 'ACTIVE' : 'UPCOMING' } }).catch(() => {})
    }
    if (dev.trips.length) writeDevice({ trips: [] })
    if (dev.cruise && !getCurrentUser()?.cruiseDay) await setCruise(dev.cruise)
    const claim = localStorage.getItem('eta_pending_visit')
    if (claim) {
      const res = await apiJson<{ ok: boolean; totalPoints?: number }>('/api/visits/pending/claim', { method: 'POST', body: { claimToken: claim } }).catch(() => null)
      localStorage.removeItem('eta_pending_visit')
      const u = getCurrentUser()
      if (res?.ok && u && typeof res.totalPoints === 'number') setCurrentUser({ ...u, points: res.totalPoints })
    }
  } catch {}
  await refreshTrips()
}

export interface UseStage {
  ready: boolean
  result: StageResult
  trips: TripView[]
  travelerType: TravelerType | null
  explored: Record<string, number>
  cruise: CruiseDay | null
  dayTrip: DeviceStage['dayTrip']
  position: { lat: number; lng: number } | null
}

/** The current stage, re-worked out when trips, the region, the position or the clock change. */
export function useStage(): UseStage {
  const { city, ready: regionReady } = useRegion()
  const position = useUserLocation()
  const [tick, setTick] = useState(0)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const bump = () => setTick(t => t + 1)
    window.addEventListener(STAGE_EVENT, bump)
    window.addEventListener(AUTH_EVENT, bump)
    const timer = setInterval(bump, 60000)
    refreshTrips().finally(() => { setReady(true); bump() })
    return () => { window.removeEventListener(STAGE_EVENT, bump); window.removeEventListener(AUTH_EVENT, bump); clearInterval(timer) }
  }, [])

  const value = useMemo(() => {
    void tick
    const dev = typeof window === 'undefined' ? EMPTY : readDevice()
    const u = typeof window === 'undefined' ? null : getCurrentUser()
    const cached = typeof window === 'undefined' ? { trips: [], explored: {} } : readCachedTrips()
    const trips = u ? cached.trips : dev.trips
    const travelerType = (u?.travelerType as TravelerType | null | undefined) ?? dev.travelerType
    const dismissed = { ...dev.dismissed }
    if (u?.stagePromptSnoozedUntil) dismissed['inJamaica:'] = Math.max(dismissed['inJamaica:'] ?? 0, Date.parse(u.stagePromptSnoozedUntil))
    const result = stageFor({ signedIn: Boolean(u), travelerType, trips, position, regionCity: city, cruise: dev.cruise, dismissed })
    return { ready: ready && regionReady, result, trips, travelerType, explored: cached.explored, cruise: dev.cruise, dayTrip: dev.dayTrip, position }
  }, [tick, ready, regionReady, city, position])

  // Keep the older trip-mode copy in step with the current trip.
  const current = value.result.trip
  useEffect(() => {
    if (!value.ready) return
    if (value.result.stage === 'countdown' || value.result.stage === 'trip') writeLegacy(current as TripView)
    else if (value.result.stage === 'between' || value.result.stage === 'browsing' || value.result.stage === 'local') writeLegacy(null)
  }, [value.ready, value.result.stage, current?.id, current?.start, current?.end]) // eslint-disable-line react-hooks/exhaustive-deps

  return value
}

/** The location pill follows the current leg; a day trip switches back at night. */
export function useLegFollower(stage: UseStage) {
  const { city, setCity } = useRegion()
  const { result, dayTrip, ready } = stage
  const follow = useCallback(() => {
    if (!ready) return
    const today = jamaicaDayKey()
    const hour = (new Date().getUTCHours() + 19) % 24
    if (dayTrip && (dayTrip.day !== today || hour >= 19 || hour < 5)) {
      setDayTrip(null)
      if (isCityCode(dayTrip.back)) setCity(dayTrip.back)
      return
    }
    if (dayTrip) return
    if ((result.stage === 'trip' || result.stage === 'cruise') && result.legCity) {
      // Once per leg (and day), so the traveler can still pick another town.
      const key = `${result.trip?.id ?? 'cruise'}:${result.legCity}:${today}`
      if (!readDevice().appliedLegs.includes(key)) {
        markLegApplied(key)
        if (city !== result.legCity) setCity(result.legCity)
      }
    }
  }, [ready, dayTrip, result.stage, result.legCity, result.trip, city, setCity])
  useEffect(() => { follow() }, [follow])
}
