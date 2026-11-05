// lib/trip-recap.ts — the end-of-trip recap: everywhere the traveler went
// between their trip dates (QR visits, photo-spot check-ins, discoveries)
// and what they booked, for the recap screen and its public share link.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'

const DAY = 86400000

export interface RecapPlace { kind: 'vendor' | 'photospot'; id: string; name: string; lat: number; lng: number; category: string | null; city: string; at: string }

export interface TripRecapData {
  name: string
  start: string
  end: string
  days: number
  places: RecapPlace[]
  towns: string[]
  booked: Array<{ name: string; date: string }>
  counts: { places: number; visits: number; firstTimers: number; booked: number }
  pointsEarned: number
}

export async function buildRecap(userId: string, start: Date, end: Date): Promise<TripRecapData | null> {
  const until = new Date(end.getTime() + DAY)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, deletedAt: true } })
  if (!user || user.deletedAt) return null
  const range = { gte: start, lt: until }
  const [checkIns, discoveries, bookings] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId, createdAt: range },
      orderBy: { createdAt: 'asc' },
      include: {
        vendor: { select: { id: true, name: true, lat: true, lng: true, category: true, city: true } },
        photoSpot: { select: { id: true, name: true, lat: true, lng: true, city: true } }
      }
    }),
    prisma.discovery.findMany({ where: { userId, createdAt: range }, select: { points: true } }),
    prisma.booking.findMany({
      where: { userId, status: { in: ['CONFIRMED', 'COMPLETED'] }, date: range },
      orderBy: { date: 'asc' },
      select: { date: true, pointsEarned: true, experience: { select: { name: true } }, accommodation: { select: { name: true } }, trip: { select: { name: true } }, vendor: { select: { name: true } } }
    })
  ])
  const places = new Map<string, RecapPlace>()
  for (const c of checkIns) {
    if (c.vendor && !places.has(`v${c.vendor.id}`)) places.set(`v${c.vendor.id}`, { kind: 'vendor', ...c.vendor, at: c.createdAt.toISOString() })
    if (c.photoSpot && !places.has(`p${c.photoSpot.id}`)) places.set(`p${c.photoSpot.id}`, { kind: 'photospot', ...c.photoSpot, category: null, at: c.createdAt.toISOString() })
  }
  const list = Array.from(places.values())
  return {
    name: user.name.split(' ')[0],
    start: start.toISOString(),
    end: end.toISOString(),
    days: Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1),
    places: list,
    towns: Array.from(new Set(list.map(p => p.city))),
    booked: bookings.map(b => ({ name: b.experience?.name ?? b.accommodation?.name ?? b.trip?.name ?? b.vendor?.name ?? 'Booking', date: b.date.toISOString() })),
    counts: { places: list.length, visits: checkIns.length, firstTimers: discoveries.length, booked: bookings.length },
    pointsEarned: checkIns.reduce((n, c) => n + c.points, 0) + discoveries.reduce((n, d) => n + d.points, 0) + bookings.reduce((n, b) => n + b.pointsEarned, 0)
  }
}

/** The public link for these trip dates, made once and reused. */
export async function recapToken(userId: string, start: Date, end: Date): Promise<string> {
  const existing = await prisma.tripRecap.findUnique({ where: { userId_start_end: { userId, start, end } } })
  if (existing) return existing.token
  const created = await prisma.tripRecap.create({ data: { userId, start, end, token: crypto.randomBytes(12).toString('base64url') } })
  return created.token
}
