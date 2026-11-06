// lib/trip-mode.ts — the traveler's trip: dates asked once (onboarding),
// where they're staying, and the partner code they came in with. Kept on
// the device (eta_trip) so it works signed out, and copied to the account
// when signed in so reminders, the recap and the home nudge can use it.
'use client'

import { useCallback, useEffect, useState } from 'react'
import { getCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { jamaicaDayKey, remainingDays, tripProgress, type TripProgress } from '@/lib/trip-dates'

const KEY = 'eta_trip'
const EVENT = 'eta-trip-change'

export interface TripInfo {
  start: string | null
  end: string | null
  stayName: string | null
  stayCity: string | null
  stayAccommodationId: string | null
  /** Where the stay is: a listing's location or a dropped pin. */
  stayLat?: number | null
  stayLng?: number | null
  stayImage?: string | null
  partnerCode: string | null
}

const EMPTY: TripInfo = { start: null, end: null, stayName: null, stayCity: null, stayAccommodationId: null, partnerCode: null }

export function readTrip(): TripInfo {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (saved && typeof saved === 'object') return { ...EMPTY, ...saved }
  } catch {}
  const u = getCurrentUser()
  if (u?.tripStart && u.tripEnd) return { ...EMPTY, start: jamaicaDayKey(new Date(u.tripStart)), end: jamaicaDayKey(new Date(u.tripEnd)), stayName: u.stayName ?? null, stayCity: u.stayCity ?? null }
  return EMPTY
}

/** Saves locally and, when signed in, on the account. */
export async function saveTrip(patch: Partial<TripInfo>): Promise<TripInfo> {
  const next = { ...readTrip(), ...patch }
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: next }))
  if (getCurrentUser()) await pushTripToAccount(next).catch(() => {})
  return next
}

/** Copies the device's trip onto the account (after logging in, too). */
export async function pushTripToAccount(trip: TripInfo = readTrip()): Promise<void> {
  const body: Record<string, unknown> = {}
  if (trip.start && trip.end) { body.tripStart = trip.start; body.tripEnd = trip.end }
  if (trip.stayName) body.stayName = trip.stayName
  if (trip.stayCity) body.stayCity = trip.stayCity
  if (trip.stayAccommodationId) body.stayAccommodationId = trip.stayAccommodationId
  if (typeof trip.stayLat === 'number' && typeof trip.stayLng === 'number') { body.stayLat = trip.stayLat; body.stayLng = trip.stayLng }
  if (Object.keys(body).length) await apiJson('/api/users/me', { method: 'PUT', body })
}

export function useTripMode(): { trip: TripInfo; progress: TripProgress | null; daysLeft: string[]; save: (patch: Partial<TripInfo>) => Promise<TripInfo> } {
  const [trip, setTrip] = useState<TripInfo>(EMPTY)
  useEffect(() => {
    setTrip(readTrip())
    const onChange = (e: Event) => setTrip((e as CustomEvent<TripInfo>).detail)
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [])
  const save = useCallback((patch: Partial<TripInfo>) => saveTrip(patch), [])
  const progress = trip.start && trip.end ? tripProgress(trip.start, trip.end) : null
  const daysLeft = trip.start && trip.end ? remainingDays(trip.start, trip.end) : []
  return { trip, progress, daysLeft, save }
}

const PLAN_DAY_KEY = 'eta_plan_day'

/** The trip day the traveler picked to plan (Experiences' day strip); bookings default to it. */
export function setPlanDay(day: string | null) {
  try { day ? sessionStorage.setItem(PLAN_DAY_KEY, day) : sessionStorage.removeItem(PLAN_DAY_KEY) } catch {}
}

export function readPlanDay(): string | null {
  try {
    const d = sessionStorage.getItem(PLAN_DAY_KEY)
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= jamaicaDayKey() ? d : null
  } catch { return null }
}

const PARTNER_CLAIMED_KEY = 'eta_partner_claimed'
const PENDING_WELCOME_KEY = 'eta_pending_welcome'

/** A welcome gift the guest tapped "Claim" on before having an account; claimed at sign-in. */
export function setPendingWelcome(rewardId: string) {
  try { localStorage.setItem(PENDING_WELCOME_KEY, rewardId) } catch {}
}

async function claimPendingWelcome() {
  let rewardId: string | null = null
  try { rewardId = localStorage.getItem(PENDING_WELCOME_KEY) } catch {}
  if (!rewardId) return
  try {
    await apiJson('/api/welcome', { method: 'POST', body: { rewardId } })
    localStorage.removeItem(PENDING_WELCOME_KEY)
  } catch {}
}

/**
 * After sign-in: claims a welcome gift tapped while signed out, copies the
 * device's trip onto the account, and joins the partner property whose code
 * was entered while signed out (claiming its welcome perk). Safe to call on
 * every load.
 */
export async function syncTripToAccount(): Promise<void> {
  if (!getCurrentUser()) return
  await claimPendingWelcome()
  let local: TripInfo | null = null
  try { local = JSON.parse(localStorage.getItem(KEY) || 'null') } catch {}
  if (!local) return
  const u = getCurrentUser()!
  const same = (u.tripStart ? jamaicaDayKey(new Date(u.tripStart)) : null) === local.start
    && (u.tripEnd ? jamaicaDayKey(new Date(u.tripEnd)) : null) === local.end
    && (u.stayName ?? null) === (local.stayName ?? null)
    && (u.stayCity ?? null) === (local.stayCity ?? null)
  // Only fills an account with no trip yet: trips on the account (lib/travel-trips)
  // win over this older device copy.
  if (!same && !u.tripStart) await pushTripToAccount({ ...EMPTY, ...local }).catch(() => {})
  const code = local.partnerCode
  try { if (!code || localStorage.getItem(PARTNER_CLAIMED_KEY) === code) return } catch { return }
  try {
    await apiJson(`/api/partners/${encodeURIComponent(code)}`, { method: 'POST' })
    localStorage.setItem(PARTNER_CLAIMED_KEY, code)
  } catch {}
}
