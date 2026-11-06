// lib/travel-trips.ts — the traveler's trips to Jamaica (TravelTrip), on
// the server. Trips live on the account so a new phone or a reinstall gets
// them back with the stage, points, explored map and saves. The current (or
// nearest) trip is also copied onto the User row (tripStart, tripEnd, stay…)
// because reminders, the recap and the "planning your next trip?" nudge
// read those.
//   tripsFor       every trip the user owns or is a member of, shaped for the app
//   createTrip     a new trip (dates, town, optional stay and legs)
//   updateTrip     dates/stay/legs; on a group trip a member's date change
//                  waits for the others to confirm (TravelTripChange)
//   pastTripStats  places, sunsets, % explored and points for a past trip
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { jamaicaDayKey, jamaicaDayStart } from '@/lib/trip-dates'
import { isCityCode, type CityCode } from '@/lib/regions'
import type { TripLite } from '@/lib/stage'

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const newInviteCode = () => Array.from(crypto.randomBytes(8), b => ALPHABET[b % ALPHABET.length]).join('')

export class TripError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

const INCLUDE = {
  legs: { orderBy: { order: 'asc' as const } },
  members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
  owner: { select: { id: true, name: true, avatarUrl: true } },
  changes: { where: { status: 'pending' }, orderBy: { createdAt: 'desc' as const } }
}

type Row = NonNullable<Awaited<ReturnType<typeof loadTrip>>>

function loadTrip(id: string) {
  return prisma.travelTrip.findUnique({ where: { id }, include: INCLUDE })
}

export interface TripView extends TripLite {
  ownerId: string
  isOwner: boolean
  pendingChange: { id: string; start: string; end: string; proposedBy: string; mine: boolean; approvedByMe: boolean } | null
  welcomeBackClaimed: boolean
}

const day = (d: Date) => jamaicaDayKey(d)

export function shape(t: Row, userId: string, extra: { returning?: boolean; visitedTown?: boolean } = {}): TripView {
  const people = [t.owner, ...t.members.map(m => m.user).filter(u => u.id !== t.ownerId)]
  const change = t.changes[0] ?? null
  return {
    id: t.id,
    kind: t.kind === 'GETAWAY' ? 'GETAWAY' : 'VISIT',
    status: (['UPCOMING', 'ACTIVE', 'ENDED', 'CANCELLED'].includes(t.status) ? t.status : 'UPCOMING') as TripLite['status'],
    city: t.city as CityCode,
    start: day(t.startDate),
    end: day(t.endDate),
    legs: t.legs.map(l => ({ city: l.city as CityCode, start: day(l.startDate), end: day(l.endDate) })),
    stayName: t.stayName,
    stayCity: (t.stayCity as CityCode | null) ?? null,
    stayLat: t.stayLat,
    stayLng: t.stayLng,
    stayAccommodationId: t.stayAccommodationId,
    partnerCode: null,
    arrivalAirport: t.arrivalAirport,
    arrivedAt: t.arrivedAt?.toISOString() ?? null,
    members: people.length > 1 ? people.map(p => ({ id: p.id, name: p.name.split(' ')[0], avatarUrl: p.avatarUrl })) : [],
    inviteCode: t.inviteCode,
    ownerId: t.ownerId,
    isOwner: t.ownerId === userId,
    pendingChange: change ? { id: change.id, start: day(change.startDate), end: day(change.endDate), proposedBy: people.find(p => p.id === change.proposedById)?.name.split(' ')[0] ?? '', mine: change.proposedById === userId, approvedByMe: change.approvedBy.includes(userId) } : null,
    welcomeBackClaimed: Boolean(t.welcomeBackRedemptionId),
    ...extra
  }
}

/** Trips the user owns or joined, newest first; flags returning travelers and towns they've been to. */
export async function tripsFor(userId: string): Promise<TripView[]> {
  const rows = await prisma.travelTrip.findMany({
    where: { status: { not: 'CANCELLED' }, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    include: INCLUDE,
    orderBy: { startDate: 'desc' }
  })
  const ended = rows.filter(r => r.status === 'ENDED' || r.endDate.getTime() + 86400000 < Date.now())
  return rows.map(r => {
    const before = ended.filter(e => e.id !== r.id && e.endDate < r.startDate)
    return shape(r, userId, { returning: before.length > 0, visitedTown: before.some(e => e.city === r.city || e.legs.some(l => l.city === r.city)) })
  })
}

export async function tripFor(userId: string, id: string): Promise<Row> {
  const t = await loadTrip(id)
  if (!t || t.status === 'CANCELLED' || (t.ownerId !== userId && !t.members.some(m => m.userId === userId))) throw new TripError('Nuttin nuh go suh', 404)
  return t
}

export interface TripInput {
  kind?: 'VISIT' | 'GETAWAY'
  city: string
  start: string
  end: string
  stayName?: string | null
  stayCity?: string | null
  stayAccommodationId?: string | null
  stayLat?: number | null
  stayLng?: number | null
  partnerPropertyId?: string | null
  arrivalAirport?: string | null
  legs?: Array<{ city: string; start: string; end: string }>
  status?: 'UPCOMING' | 'ACTIVE'
}

function checkDates(start: string, end: string) {
  if (end < start) throw new TripError('The trip can’t end before it starts')
  if (Date.parse(end) - Date.parse(start) > 120 * 86400000) throw new TripError('That’s a long trip — keep it under four months')
}

function legRows(input: TripInput) {
  const legs = (input.legs ?? []).filter(l => isCityCode(l.city) && l.start && l.end)
  for (const l of legs) {
    if (l.end < l.start) throw new TripError('A stop can’t end before it starts')
    if (l.start < input.start || l.end > input.end) throw new TripError('Each town’s dates must sit inside the trip')
  }
  return legs.map((l, i) => ({ city: l.city as never, startDate: jamaicaDayStart(l.start), endDate: jamaicaDayStart(l.end), order: i }))
}

export async function createTrip(userId: string, input: TripInput): Promise<TripView> {
  if (!isCityCode(input.city)) throw new TripError('Pick a town')
  checkDates(input.start, input.end)
  const today = jamaicaDayKey()
  const status = input.status === 'ACTIVE' ? 'ACTIVE' : 'UPCOMING'
  const legs = legRows(input)
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const t = await prisma.travelTrip.create({
        data: {
          kind: input.kind === 'GETAWAY' ? 'GETAWAY' : 'VISIT',
          status,
          city: input.city as never,
          startDate: jamaicaDayStart(input.start),
          endDate: jamaicaDayStart(input.end),
          stayName: input.stayName?.trim() || null,
          stayCity: isCityCode(input.stayCity) ? (input.stayCity as never) : null,
          stayAccommodationId: input.stayAccommodationId ?? null,
          stayLat: input.stayLat ?? null,
          stayLng: input.stayLng ?? null,
          partnerPropertyId: input.partnerPropertyId ?? null,
          arrivalAirport: input.arrivalAirport ?? null,
          arrivedAt: status === 'ACTIVE' && input.start <= today ? new Date() : null,
          inviteCode: newInviteCode(),
          ownerId: userId,
          legs: legs.length ? { create: legs } : undefined
        },
        include: INCLUDE
      })
      await syncUserTrip(userId)
      return shape(t, userId)
    } catch (e) {
      if ((e as { code?: string }).code !== 'P2002') throw e
    }
  }
  throw new TripError('Sumth nah wuk', 500)
}

export type TripPatch = Partial<Omit<TripInput, 'status'>> & { status?: 'UPCOMING' | 'ACTIVE' | 'ENDED' }

/** Edits a trip. On a group trip, any member’s date change waits for the others to confirm. */
export async function updateTrip(userId: string, id: string, patch: TripPatch): Promise<{ trip: TripView; pending: boolean }> {
  const t = await tripFor(userId, id)
  const start = patch.start ?? day(t.startDate)
  const end = patch.end ?? day(t.endDate)
  const datesChanged = start !== day(t.startDate) || end !== day(t.endDate)
  if (datesChanged) checkDates(start, end)
  const others = [t.ownerId, ...t.members.map(m => m.userId)].filter((u, i, a) => u !== userId && a.indexOf(u) === i)
  let pending = false
  if (datesChanged && others.length > 0) {
    // Everyone shares the dates: propose it, the others confirm.
    await prisma.travelTripChange.updateMany({ where: { tripId: id, status: 'pending' }, data: { status: 'declined', resolvedAt: new Date() } })
    await prisma.travelTripChange.create({ data: { tripId: id, proposedById: userId, startDate: jamaicaDayStart(start), endDate: jamaicaDayStart(end), approvedBy: [userId] } })
    pending = true
  }
  const legs = patch.legs ? legRows({ city: patch.city ?? t.city, start, end, legs: patch.legs }) : null
  await prisma.travelTrip.update({
    where: { id },
    data: {
      ...(patch.city && isCityCode(patch.city) ? { city: patch.city as never } : {}),
      ...(datesChanged && !pending ? { startDate: jamaicaDayStart(start), endDate: jamaicaDayStart(end) } : {}),
      ...(patch.stayName !== undefined ? { stayName: patch.stayName?.trim() || null } : {}),
      ...(patch.stayCity !== undefined ? { stayCity: isCityCode(patch.stayCity) ? (patch.stayCity as never) : null } : {}),
      ...(patch.stayAccommodationId !== undefined ? { stayAccommodationId: patch.stayAccommodationId } : {}),
      ...(patch.stayLat !== undefined ? { stayLat: patch.stayLat } : {}),
      ...(patch.stayLng !== undefined ? { stayLng: patch.stayLng } : {}),
      ...(patch.partnerPropertyId !== undefined ? { partnerPropertyId: patch.partnerPropertyId } : {}),
      ...(patch.arrivalAirport !== undefined ? { arrivalAirport: patch.arrivalAirport } : {}),
      ...(patch.kind ? { kind: patch.kind } : {}),
      ...(patch.status === 'ACTIVE' ? { status: 'ACTIVE', arrivedAt: t.arrivedAt ?? new Date() } : {}),
      ...(patch.status === 'ENDED' ? { status: 'ENDED', endedAt: new Date() } : {}),
      ...(patch.status === 'UPCOMING' ? { status: 'UPCOMING', arrivedAt: null } : {}),
      ...(legs ? { legs: { deleteMany: {}, create: legs } } : {})
    }
  })
  await Promise.all([userId, ...others].map(syncUserTrip))
  return { trip: shape((await loadTrip(id))!, userId), pending }
}

/** A member confirms (or turns down) a proposed date change; applied once everyone has confirmed. */
export async function answerChange(userId: string, tripId: string, changeId: string, approve: boolean): Promise<TripView> {
  const t = await tripFor(userId, tripId)
  const change = await prisma.travelTripChange.findFirst({ where: { id: changeId, tripId, status: 'pending' } })
  if (!change) throw new TripError('That change was already sorted', 404)
  const everyone = [t.ownerId, ...t.members.map(m => m.userId)].filter((u, i, a) => a.indexOf(u) === i)
  if (!approve) {
    await prisma.travelTripChange.update({ where: { id: changeId }, data: { status: 'declined', resolvedAt: new Date() } })
  } else {
    const approvedBy = Array.from(new Set([...change.approvedBy, userId]))
    const all = everyone.every(u => approvedBy.includes(u))
    await prisma.travelTripChange.update({ where: { id: changeId }, data: { approvedBy, ...(all ? { status: 'applied', resolvedAt: new Date() } : {}) } })
    if (all) {
      await prisma.travelTrip.update({ where: { id: tripId }, data: { startDate: change.startDate, endDate: change.endDate } })
      await Promise.all(everyone.map(syncUserTrip))
    }
  }
  return shape((await loadTrip(tripId))!, userId)
}

/** Deletes (cancels) a trip the user owns; a member leaves it instead. */
export async function deleteTrip(userId: string, id: string): Promise<void> {
  const t = await tripFor(userId, id)
  if (t.ownerId === userId) await prisma.travelTrip.update({ where: { id }, data: { status: 'CANCELLED' } })
  else await prisma.travelTripMember.deleteMany({ where: { tripId: id, userId } })
  await syncUserTrip(userId)
}

/** Joining a friend's trip by its invite link copies its dates and town. */
export async function joinTrip(userId: string, code: string): Promise<TripView> {
  const t = await prisma.travelTrip.findUnique({ where: { inviteCode: code.trim().toUpperCase() }, select: { id: true, status: true, ownerId: true } })
  if (!t || t.status === 'CANCELLED') throw new TripError('That trip link doesn’t work any more', 404)
  if (t.ownerId !== userId) {
    await prisma.travelTripMember.upsert({ where: { tripId_userId: { tripId: t.id, userId } }, create: { tripId: t.id, userId }, update: {} })
    await prisma.user.update({ where: { id: userId }, data: { travelerType: 'VISITOR' } }).catch(() => {})
  }
  await syncUserTrip(userId)
  return shape((await loadTrip(t.id))!, userId)
}

export async function invitePreview(code: string) {
  const t = await prisma.travelTrip.findUnique({ where: { inviteCode: code.trim().toUpperCase() }, include: { owner: { select: { name: true, avatarUrl: true } }, legs: { orderBy: { order: 'asc' } }, _count: { select: { members: true } } } })
  if (!t || t.status === 'CANCELLED') return null
  return { code: t.inviteCode, city: t.city, start: day(t.startDate), end: day(t.endDate), stayName: t.stayName, owner: { name: t.owner.name.split(' ')[0], avatarUrl: t.owner.avatarUrl }, people: t._count.members + 1, legs: t.legs.map(l => ({ city: l.city, start: day(l.startDate), end: day(l.endDate) })) }
}

/**
 * Copies the current trip (active, else the nearest upcoming, else the last
 * one) onto the User row, which reminders, the recap and nudges read.
 */
export async function syncUserTrip(userId: string): Promise<void> {
  const trips = await prisma.travelTrip.findMany({
    where: { status: { not: 'CANCELLED' }, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { startDate: 'asc' }
  })
  const now = Date.now()
  const pick = trips.find(t => t.status === 'ACTIVE')
    ?? trips.find(t => t.status === 'UPCOMING' && t.endDate.getTime() + 86400000 > now)
    ?? trips.filter(t => t.status === 'ENDED').pop()
    ?? null
  await prisma.user.update({
    where: { id: userId },
    data: pick
      ? { tripStart: pick.startDate, tripEnd: pick.endDate, stayName: pick.stayName, stayCity: pick.stayCity ?? pick.city, stayAccommodationId: pick.stayAccommodationId, stayLat: pick.stayLat, stayLng: pick.stayLng }
      : { tripStart: null, tripEnd: null }
  })
}

/** Places, sunsets, % of the town explored, points and three photos for a past trip. */
export async function pastTripStats(userId: string, trip: { city: string; startDate: Date; endDate: Date }) {
  const from = trip.startDate
  const to = new Date(trip.endDate.getTime() + 86400000)
  const [checkIns, stories, townVendors, points] = await Promise.all([
    prisma.checkIn.findMany({ where: { userId, createdAt: { gte: from, lt: to } }, select: { createdAt: true, vendorId: true, photoSpotId: true, points: true, vendor: { select: { images: true, city: true } }, photoSpot: { select: { officialPhoto: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.story.findMany({ where: { userId, createdAt: { gte: from, lt: to } }, select: { imageUrl: true }, orderBy: { createdAt: 'asc' }, take: 6 }),
    prisma.vendor.count({ where: { city: trip.city as never, visibleInMarketplace: true, isTransport: false } }),
    prisma.discovery.aggregate({ where: { userId, createdAt: { gte: from, lt: to } }, _sum: { points: true } })
  ])
  const places = new Set(checkIns.map(c => c.vendorId ?? c.photoSpotId).filter(Boolean)).size
  const inTown = new Set(checkIns.filter(c => c.vendor?.city === trip.city).map(c => c.vendorId)).size
  const nights = Math.max(1, Math.round((trip.endDate.getTime() - trip.startDate.getTime()) / 86400000))
  const photos = [...stories.map(s => s.imageUrl), ...checkIns.map(c => c.vendor?.images[0] ?? c.photoSpot?.officialPhoto ?? null)].filter((u): u is string => Boolean(u))
  return {
    places,
    sunsets: nights,
    explored: townVendors ? Math.min(100, Math.round((inTown / townVendors) * 100)) : 0,
    points: checkIns.reduce((s, c) => s + c.points, 0) + (points._sum.points ?? 0),
    photos: Array.from(new Set(photos)).slice(0, 3)
  }
}

/** % of each town's places the user has checked in at (Plan My Next Trip's "Been here · 34% explored"). */
export async function exploredByTown(userId: string): Promise<Record<string, number>> {
  const [mine, totals] = await Promise.all([
    prisma.checkIn.findMany({ where: { userId, vendorId: { not: null } }, select: { vendorId: true, vendor: { select: { city: true } } }, distinct: ['vendorId'] }),
    prisma.vendor.groupBy({ by: ['city'], where: { visibleInMarketplace: true, isTransport: false }, _count: { _all: true } })
  ])
  const visited: Record<string, number> = {}
  for (const c of mine) if (c.vendor) visited[c.vendor.city] = (visited[c.vendor.city] ?? 0) + 1
  const out: Record<string, number> = {}
  for (const row of totals) if (visited[row.city]) out[row.city] = Math.min(100, Math.max(1, Math.round((visited[row.city] / row._count._all) * 100)))
  return out
}
