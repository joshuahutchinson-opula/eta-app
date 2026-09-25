// lib/experience-stops.ts — how every reader loads an experience's route.
// An Experience no longer belongs to one vendor; it's an ordered list of
// ExperienceStops (vendors and photo spots) with the transport between them.
// Places that still want a single "host" (cards, "Hosted by …") use the first
// vendor stop.

import type { Prisma } from '@prisma/client'

export const EXPERIENCE_STOPS_INCLUDE = {
  stops: {
    orderBy: { order: 'asc' },
    include: {
      vendor: {
        select: {
          id: true, name: true, category: true, neighborhood: true, city: true, lat: true, lng: true,
          images: true, isPremium: true, priceRange: true, instagram: true, website: true,
          reviews: { select: { rating: true } }
        }
      },
      photoSpot: { select: { id: true, name: true, officialPhoto: true, bestTime: true, lat: true, lng: true } }
    }
  }
} satisfies Prisma.ExperienceInclude

type StopRow = Prisma.ExperienceStopGetPayload<{ include: typeof EXPERIENCE_STOPS_INCLUDE.stops.include }>

export interface ExperienceStopView {
  order: number
  type: 'vendor' | 'photospot'
  id: string
  name: string
  image: string | null
  category: string | null
  lat: number
  lng: number
  plannedDuration: number
  transportModeToNext: 'WALKING' | 'TAXI' | 'BOAT' | null
  transportDurationToNext: number | null
}

export function stopViews(stops: StopRow[]): ExperienceStopView[] {
  return stops.flatMap((s): ExperienceStopView[] => {
    const base = {
      order: s.order,
      plannedDuration: s.plannedDuration,
      transportModeToNext: s.transportModeToNext,
      transportDurationToNext: s.transportDurationToNext
    }
    if (s.vendor) {
      return [{ ...base, type: 'vendor' as const, id: s.vendor.id, name: s.vendor.name, image: s.vendor.images[0] ?? null, category: s.vendor.category, lat: s.vendor.lat, lng: s.vendor.lng }]
    }
    if (s.photoSpot) {
      return [{ ...base, type: 'photospot' as const, id: s.photoSpot.id, name: s.photoSpot.name, image: s.photoSpot.officialPhoto, category: null, lat: s.photoSpot.lat, lng: s.photoSpot.lng }]
    }
    return []
  })
}

/** First vendor on the route — what cards show as "Hosted by". */
export function hostVendor(stops: StopRow[]) {
  return stops.find(s => s.vendor)?.vendor ?? null
}

/** Minutes from the first stop to the end of the last, travel included. */
export function routeMinutes(stops: Array<{ plannedDuration: number; transportDurationToNext: number | null }>): number {
  return stops.reduce((m, s) => m + s.plannedDuration + (s.transportDurationToNext ?? 0), 0)
}

/** Every review across the route's vendors — an experience has no reviews of its own. */
export function routeRatings(stops: StopRow[]): number[] {
  return stops.flatMap(s => s.vendor?.reviews.map(r => r.rating) ?? [])
}
