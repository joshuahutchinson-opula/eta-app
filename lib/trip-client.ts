// lib/trip-client.ts
'use client'

import type { TripDTO } from '@/lib/trips'
import { getCurrentUser } from '@/lib/auth-client'

export type { TripDTO, TripStopDTO, TripMemberDTO } from '@/lib/trips'
export type TripView = TripDTO & { canEdit?: boolean }

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

/** Which crew member this device is, on a shared trip link. */
export function getMemberId(slug: string): string | null {
  try { return localStorage.getItem(`eta_trip_member_${slug}`) } catch { return null }
}

export function setMemberId(slug: string, memberId: string) {
  localStorage.setItem(`eta_trip_member_${slug}`, memberId)
}

export function tripShareUrl(slug: string): string {
  return `${window.location.origin}/trip/${slug}`
}

export async function tripApi<T = TripView>(slug: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = getTripKey(slug)
  const res = await fetch(`/api/trips/${slug}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-trip-key': key } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
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
  const user = getCurrentUser()
  const res = await fetch('/api/trips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, ownerId: user?.id, ownerName: user?.name?.split(' ')[0] })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
  rememberTrip({ slug: data.trip.slug, editKey: data.editKey, name: data.trip.name })
  return { ...data.trip, canEdit: true }
}

/** Trips created on this device or owned by the signed-in user, newest first. */
export async function fetchMyTrips(statuses: TripDTO['status'][] = ['PLANNING', 'BOOKED']): Promise<TripView[]> {
  const mine = readMine()
  const user = getCurrentUser()
  const params = new URLSearchParams()
  if (mine.length) params.set('slugs', mine.map(t => t.slug).join(','))
  if (user) params.set('ownerId', user.id)
  if (!params.toString()) return []
  const res = await fetch(`/api/trips?${params}`)
  if (!res.ok) return []
  const trips: TripDTO[] = await res.json()
  return trips
    .filter(t => statuses.includes(t.status))
    .map(t => ({ ...t, canEdit: Boolean(getTripKey(t.slug)) }))
}

export async function addStopToTrip(slug: string, stop: { vendorId?: string; experienceId?: string; photoSpotId?: string }) {
  const user = getCurrentUser()
  return tripApi<TripView & { alreadyAdded: boolean }>(slug, '/stops', {
    method: 'POST',
    body: { ...stop, addedBy: user?.name?.split(' ')[0] ?? 'You' }
  })
}
