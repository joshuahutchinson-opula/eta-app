// lib/trips.ts
// Server-side trip logic shared by every /api/trips route. A Trip is an
// ordered list of stops (vendors, experiences, photo spots) plus a crew.
//
// Access model (matching the rest of the API, which has no server-side
// session): the unguessable slug is the share link. Anyone holding it can
// view, and for app trips can join the crew, vote and suggest stops. The
// editKey — returned once at creation and kept on the creator's device —
// is required for owner actions: renaming, removing stops, booking, and
// any edit at all on a no-login web trip.

import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const TRIP_INCLUDE = {
  experience: { select: { id: true, name: true, tagline: true, price: true, imageUrl: true, travelTime: true, travelMode: true, startLocation: true } },
  booking: { select: { id: true, status: true, pointsEarned: true, totalPrice: true, date: true, userId: true } },
  stops: {
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: {
      vendor: { select: { id: true, name: true, category: true, neighborhood: true, images: true, lat: true, lng: true, live: true, open: true, whoThere: true, priceRange: true } },
      experience: { select: { id: true, name: true, tagline: true, imageUrl: true, price: true, startLocation: true } },
      photoSpot: { select: { id: true, name: true, bestTime: true, officialPhoto: true, lat: true, lng: true } },
      votes: { select: { memberId: true, value: true } }
    }
  },
  members: { orderBy: { joinedAt: 'asc' } }
} satisfies Prisma.TripInclude

export type TripWithRelations = Prisma.TripGetPayload<{ include: typeof TRIP_INCLUDE }>

export interface TripStopDTO {
  id: string
  order: number
  time: string | null
  note: string | null
  addedBy: string | null
  kind: 'vendor' | 'experience' | 'photospot'
  refId: string
  name: string
  subtitle: string
  image: string | null
  lat: number | null
  lng: number | null
  live: boolean
  votes: { up: number; down: number; byMember: Record<string, number> }
}

export interface TripMemberDTO {
  id: string
  name: string
  isOwner: boolean
  status: string
  share: number
  paid: boolean
}

export interface TripDTO {
  id: string
  slug: string
  name: string
  status: 'PLANNING' | 'BOOKED' | 'COMPLETED' | 'CANCELLED'
  source: string
  city: string
  date: string | null
  notes: string | null
  createdAt: string
  ownerId: string | null
  experience: TripWithRelations['experience']
  booking: { id: string; status: string; pointsEarned: number; totalPrice: number; date: string } | null
  stops: TripStopDTO[]
  members: TripMemberDTO[]
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

export function toTripDTO(trip: TripWithRelations): TripDTO {
  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.name,
    status: trip.status,
    source: trip.source,
    city: trip.city,
    date: trip.date?.toISOString() ?? null,
    notes: trip.notes,
    createdAt: trip.createdAt.toISOString(),
    ownerId: trip.ownerId,
    experience: trip.experience,
    booking: trip.booking
      ? { id: trip.booking.id, status: trip.booking.status, pointsEarned: trip.booking.pointsEarned, totalPrice: trip.booking.totalPrice, date: trip.booking.date.toISOString() }
      : null,
    stops: trip.stops.map(s => {
      const up = s.votes.filter(v => v.value > 0).length
      const down = s.votes.filter(v => v.value < 0).length
      const byMember = Object.fromEntries(s.votes.map(v => [v.memberId, v.value]))
      const base = { id: s.id, order: s.order, time: s.time, note: s.note, addedBy: s.addedBy, votes: { up, down, byMember } }
      if (s.vendor) {
        return { ...base, kind: 'vendor' as const, refId: s.vendor.id, name: s.vendor.name, subtitle: `${titleCase(s.vendor.category)} · ${s.vendor.neighborhood}`, image: s.vendor.images[0] ?? null, lat: s.vendor.lat, lng: s.vendor.lng, live: s.vendor.live }
      }
      if (s.experience) {
        return { ...base, kind: 'experience' as const, refId: s.experience.id, name: s.experience.name, subtitle: s.experience.tagline, image: s.experience.imageUrl, lat: null, lng: null, live: false }
      }
      return { ...base, kind: 'photospot' as const, refId: s.photoSpot?.id ?? '', name: s.photoSpot?.name ?? 'Photo spot', subtitle: `Best at ${s.photoSpot?.bestTime ?? 'any time'}`, image: s.photoSpot?.officialPhoto ?? null, lat: s.photoSpot?.lat ?? null, lng: s.photoSpot?.lng ?? null, live: false }
    }),
    members: trip.members.map(m => ({ id: m.id, name: m.name, isOwner: m.isOwner, status: m.status, share: m.share, paid: m.paid }))
  }
}

export function newSlug(): string {
  // 64 random bits: unguessable enough to act as a share link.
  return crypto.randomBytes(8).toString('hex')
}

export function newEditKey(): string {
  return crypto.randomBytes(18).toString('base64url')
}

export async function loadTrip(slug: string) {
  return prisma.trip.findUnique({ where: { slug }, include: TRIP_INCLUDE })
}

/** True when the request carries the trip's editKey (header x-trip-key or body.editKey). */
export function hasEditKey(trip: { editKey: string | null }, request: Request, body?: { editKey?: unknown }): boolean {
  const provided = request.headers.get('x-trip-key') ?? (typeof body?.editKey === 'string' ? body.editKey : null)
  if (!trip.editKey || !provided) return false
  const a = Buffer.from(trip.editKey)
  const b = Buffer.from(provided)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Crew actions (vote, join, suggest) are open on app trips; web trips are read-only without the key. */
export function canCollaborate(trip: { source: string; editKey: string | null; status: string }, request: Request, body?: { editKey?: unknown }): boolean {
  if (trip.status === 'CANCELLED' || trip.status === 'COMPLETED') return false
  if (hasEditKey(trip, request, body)) return true
  return trip.source === 'app'
}

/** Each crew member pays the experience's per-person price (the existing split model). */
export async function recalcShares(tripId: string) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { experience: { select: { price: true } } } })
  if (!trip) return
  const share = trip.experience ? Math.round(trip.experience.price) : 0
  await prisma.tripMember.updateMany({ where: { tripId }, data: { share } })
}

export async function nextStopOrder(tripId: string): Promise<number> {
  const last = await prisma.tripStop.findFirst({ where: { tripId }, orderBy: { order: 'desc' }, select: { order: true } })
  return (last?.order ?? -1) + 1
}

export interface StopInput {
  vendorId?: string
  experienceId?: string
  photoSpotId?: string
  time?: string
  note?: string
}

export function cleanStopInput(raw: unknown): StopInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown, max = 200) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
  const input: StopInput = {
    vendorId: str(r.vendorId, 64),
    experienceId: str(r.experienceId, 64),
    photoSpotId: str(r.photoSpotId, 64),
    time: str(r.time, 20),
    note: str(r.note, 280)
  }
  const refs = [input.vendorId, input.experienceId, input.photoSpotId].filter(Boolean)
  return refs.length === 1 ? input : null
}
