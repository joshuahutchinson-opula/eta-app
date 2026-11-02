// lib/trip-client.ts
'use client'

import type { TripDTO } from '@/lib/trips'
import { getCurrentUser } from '@/lib/auth-client'
import { authHeaders } from '@/lib/api-client'
import { absoluteUrl } from '@/lib/site-url'
import { ApiError, responseError } from '@/lib/errors'

export type { TripDTO, TripStopDTO, TripMemberDTO } from '@/lib/trips'
export type TripView = TripDTO & { canEdit?: boolean; invite?: { name: string | null; owner: string | null } }

interface RememberedTrip {
  slug: string
  editKey?: string
  name: string
}

const MY_TRIPS = 'eta_my_trips'

function readMine(): RememberedTrip[] {
  try {
    const raw = JSON.parse(localStorage.getItem(MY_TRIPS) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function rememberTrip(trip: RememberedTrip) {
  const rest = readMine().filter(t => t.slug !== trip.slug)
  const prev = readMine().find(t => t.slug === trip.slug)
  localStorage.setItem(MY_TRIPS, JSON.stringify([{ ...prev, ...trip }, ...rest].slice(0, 25)))
}

export function forgetTrip(slug: string) {
  localStorage.setItem(MY_TRIPS, JSON.stringify(readMine().filter(t => t.slug !== slug)))
}

export function getTripKey(slug: string): string | undefined {
  return readMine().find(t => t.slug === slug)?.editKey
}

/** Invite (?invite=) and view (?view=) tokens from the link this page was opened with. */
function linkTokens(slug: string): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const q = new URLSearchParams(window.location.search)
  const out: Record<string, string> = {}
  const onThisTrip = window.location.pathname.includes(slug)
  if (onThisTrip && q.get('invite')) out['x-trip-invite'] = q.get('invite')!
  if (onThisTrip && q.get('view')) out['x-trip-view'] = q.get('view')!
  return out
}

/** The crew link for a trip. Joining needs an invite link (createInviteLink). */
export function tripShareUrl(slug: string): string {
  return absoluteUrl(`/trip/${slug}`)
}

export async function tripApi<T = TripView>(slug: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = getTripKey(slug)
  const res = await fetch(`/api/trips/${slug}${path}`, {
    method: init.method ?? 'GET',
    headers: authHeaders({ 'Content-Type': 'application/json', ...(key ? { 'x-trip-key': key } : {}), ...linkTokens(slug) }),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || '', res.status, data.code)
  return data as T
}

export async function createTrip(input: {
  name?: string
  experienceId?: string
  crew?: string[]
  stops?: Array<{ vendorId?: string; experienceId?: string; photoSpotId?: string; time?: string; note?: string }>
  source?: 'app' | 'web'
  city?: string
  date?: string
  notes?: string
}): Promise<TripView> {
  const res = await fetch('/api/trips', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(input)
  })
  if (!res.ok) throw await responseError(res)
  const data = await res.json()
  rememberTrip({ slug: data.trip.slug, editKey: data.editKey, name: data.trip.name })
  return { ...data.trip, canEdit: true }
}

/** Trips the signed-in user owns or joined (plus web plans made on this device), newest first. */
export async function fetchMyTrips(statuses: TripDTO['status'][] = ['PLANNING', 'BOOKED']): Promise<TripView[]> {
  const web = readMine()
  const params = new URLSearchParams()
  if (web.length) params.set('slugs', web.map(t => t.slug).join(','))
  if (!getCurrentUser() && !params.toString()) return []
  const res = await fetch(`/api/trips?${params}`, { headers: authHeaders() })
  if (!res.ok) return []
  const trips: TripDTO[] = await res.json()
  return trips
    .filter(t => statuses.includes(t.status))
    .map(t => ({ ...t, canEdit: t.access === 'owner' || Boolean(getTripKey(t.slug)) }))
}

export type BookedTrip = TripView & { bookingId?: string; transactionId?: string | null; walletBalance?: number | null }

/** Books a planned trip with the traveler's date, time and party size, paying from the ETA Wallet. */
export async function bookTripPaid(slug: string, details: { date: string; time: string | null; partySize: number }, estimatedPrice?: number, split = false): Promise<BookedTrip> {
  if (!getCurrentUser()) throw new ApiError('Log in to book — your trip is saved on this device.', 401, 'LOGIN_REQUIRED')
  const booked = await tripApi<BookedTrip>(slug, '/book', {
    method: 'POST',
    body: { ...details, estimatedPrice, payWithWallet: true, split }
  })
  return { ...booked, canEdit: true }
}

export async function addStopToTrip(slug: string, stop: { vendorId?: string; experienceId?: string; photoSpotId?: string }) {
  return tripApi<TripView & { alreadyAdded: boolean }>(slug, '/stops', { method: 'POST', body: stop })
}

/** A link that lets someone join the crew with their own account. */
export async function createInviteLink(slug: string, name?: string): Promise<string> {
  const { url } = await tripApi<{ url: string }>(slug, '/invites', { method: 'POST', body: { name } })
  return url
}

/** A read-only link to follow the trip live (Safety screen). */
export async function createViewLink(slug: string): Promise<string> {
  const { url } = await tripApi<{ url: string }>(slug, '/view-link', { method: 'POST' })
  return url
}
