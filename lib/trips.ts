// lib/trips.ts
// Server-side trip logic shared by every /api/trips route. A Trip is an
// ordered list of stops (vendors, experiences, photo spots) plus a crew.
//
// Access model (tripAccess below). The slug alone is no longer enough:
//  • owner — the signed-in owner, or whoever holds the editKey (returned
//    once at creation; the only credential for no-login web trips);
//  • member — a signed-in user who joined through an invite link;
//  • invitee — holds a valid invite token, sees a preview and can join;
//  • viewer — holds the trip's viewToken (Safety → share live trip) and
//    sees read-only progress. Web trips stay readable by slug: that link
//    is the web planner's public share.
// Owners and members can vote, suggest stops and chat; only owners
// rename, remove stops, book and finish.

import crypto from 'crypto'
import type { Prisma, TripMember } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'

export const TRIP_INCLUDE = {
  experience: { select: { id: true, name: true, tagline: true, price: true, imageUrl: true, travelTime: true, travelMode: true, startLocation: true, startTimes: true, maxPartySize: true, capacityPerSlot: true, cancellationTier: true, cancellationPolicy: true } },
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
  members: { orderBy: { joinedAt: 'asc' } },
  invites: { select: { token: true, acceptedAt: true } }
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
  /** Joined with their own account (can pay their share and chat). */
  hasAccount: boolean
  /** Live position, only for the crew, only while the trip is booked and they're sharing. */
  location: { lat: number; lng: number; at: string } | null
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
  currentStopIndex: number
  createdAt: string
  ownerId: string | null
  experience: TripWithRelations['experience']
  booking: { id: string; status: string; pointsEarned: number; totalPrice: number; date: string } | null
  splitPayment: boolean
  stops: TripStopDTO[]
  members: TripMemberDTO[]
  /** Which member the caller is (null when they aren't one). */
  myMemberId?: string | null
  /** owner | member | viewer — what the caller can do. */
  access?: TripRole
}

function titleCase(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

/** Shared positions older than this aren't shown. */
const LOCATION_FRESH_MS = 20 * 60000

export function toTripDTO(trip: TripWithRelations, access?: TripAccess): TripDTO {
  const crew = access?.role === 'owner' || access?.role === 'member'
  const live = crew && trip.status === 'BOOKED'
  return {
    id: trip.id,
    slug: trip.slug,
    name: trip.name,
    status: trip.status,
    source: trip.source,
    city: trip.city,
    date: trip.date?.toISOString() ?? null,
    notes: trip.notes,
    currentStopIndex: trip.currentStopIndex,
    createdAt: trip.createdAt.toISOString(),
    ownerId: trip.ownerId,
    experience: trip.experience,
    booking: trip.booking
      ? { id: trip.booking.id, status: trip.booking.status, pointsEarned: trip.booking.pointsEarned, totalPrice: trip.booking.totalPrice, date: trip.booking.date.toISOString() }
      : null,
    splitPayment: trip.splitPayment,
    myMemberId: access?.member?.id ?? null,
    access: access?.role ?? undefined,
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
    members: trip.members.map(m => ({
      id: m.id, name: m.name, isOwner: m.isOwner, status: m.status, share: m.share, paid: m.paid,
      hasAccount: Boolean(m.userId),
      location: live && m.sharingLocation && m.lat !== null && m.lng !== null && m.locationAt && Date.now() - m.locationAt.getTime() < LOCATION_FRESH_MS
        ? { lat: m.lat, lng: m.lng, at: m.locationAt.toISOString() }
        : null
    }))
  }
}

export type TripRole = 'owner' | 'member' | 'invitee' | 'viewer'

export interface TripAccess {
  role: TripRole | null
  userId: string | null
  member: TripMember | null
  invite: { token: string; name: string | null } | null
}

/**
 * What the caller may do with this trip. Credentials: Bearer token (owner /
 * member), x-trip-key or body.editKey (owner), x-trip-invite or ?invite=
 * (invitee), x-trip-view or ?view= (viewer).
 */
export async function tripAccess(
  trip: { id: string; source: string; editKey: string | null; ownerId: string | null; viewToken: string | null },
  request: Request,
  body?: { editKey?: unknown }
): Promise<TripAccess> {
  const userId = userIdFromRequest(request)
  const url = new URL(request.url)
  const member = userId ? await prisma.tripMember.findFirst({ where: { tripId: trip.id, userId } }) : null
  const base = { userId, member, invite: null }
  if (hasEditKey(trip, request, body) || (userId && trip.ownerId === userId)) {
    return { ...base, role: 'owner', member: member ?? (await prisma.tripMember.findFirst({ where: { tripId: trip.id, isOwner: true } })) }
  }
  if (member) return { ...base, role: 'member' }
  const inviteToken = request.headers.get('x-trip-invite') ?? url.searchParams.get('invite')
  if (inviteToken) {
    const invite = await prisma.tripInvite.findFirst({ where: { tripId: trip.id, token: inviteToken }, select: { token: true, name: true } })
    if (invite) return { ...base, role: 'invitee', invite }
  }
  const viewToken = request.headers.get('x-trip-view') ?? url.searchParams.get('view')
  if ((viewToken && trip.viewToken && safeEqual(viewToken, trip.viewToken)) || trip.source === 'web') return { ...base, role: 'viewer' }
  return { ...base, role: null }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

export function isCrew(access: TripAccess): boolean {
  return access.role === 'owner' || access.role === 'member'
}

/** A token for invite and view links. */
export function newToken(): string {
  return crypto.randomBytes(12).toString('base64url')
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

/** Crew actions (vote, suggest, chat) need an open trip and an owner or member. */
export function canCollaborate(trip: { status: string }, access: TripAccess): boolean {
  if (trip.status === 'CANCELLED' || trip.status === 'COMPLETED') return false
  return isCrew(access)
}

export const NO_ACCESS = 'Ask the trip owner for an invite link'

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
