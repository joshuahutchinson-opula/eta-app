// lib/recap.ts
// Post-trip recap (B5): what a completed trip actually was — its stops,
// the points it earned, and the photos taken along the way.

import { prisma } from '@/lib/prisma'
import { loadTrip, toTripDTO, type TripDTO } from '@/lib/trips'

export interface TripRecap {
  trip: TripDTO
  pointsEarned: number
  /** Photos the trip owner posted as moments during the trip window. */
  moments: Array<{ id: string; url: string; caption: string | null; spot: string | null }>
  /** Stop photos, used to fill the card when no moments were posted. */
  stopPhotos: string[]
  distanceKm: number | null
  completedAt: string
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export async function getTripRecap(slug: string): Promise<TripRecap | null> {
  const raw = await loadTrip(slug)
  if (!raw || raw.status !== 'COMPLETED') return null
  const trip = toTripDTO(raw)

  const start = new Date((raw.booking?.date ?? raw.createdAt).getTime() - 6 * 3600000)
  const end = new Date(raw.updatedAt.getTime() + 2 * 3600000)
  const ownerId = raw.booking?.userId ?? raw.ownerId
  const moments = ownerId
    ? await prisma.userMoment.findMany({
        where: { userId: ownerId, createdAt: { gte: start, lte: end } },
        orderBy: { createdAt: 'asc' },
        take: 12,
        include: { photoSpot: { select: { name: true } } }
      })
    : []

  const located = trip.stops.filter((s): s is typeof s & { lat: number; lng: number } => s.lat !== null && s.lng !== null)
  let distanceKm: number | null = null
  if (located.length > 1) {
    distanceKm = 0
    for (let i = 1; i < located.length; i++) distanceKm += haversine(located[i - 1], located[i])
    distanceKm = Math.round(distanceKm * 10) / 10
  }

  return {
    trip,
    pointsEarned: raw.booking?.pointsEarned ?? 0,
    moments: moments.map(m => ({ id: m.id, url: m.url, caption: m.caption, spot: m.photoSpot?.name ?? null })),
    stopPhotos: trip.stops.map(s => s.image).filter((u): u is string => Boolean(u)),
    distanceKm,
    completedAt: raw.updatedAt.toISOString()
  }
}
