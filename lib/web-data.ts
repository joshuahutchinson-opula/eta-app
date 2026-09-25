// lib/web-data.ts
// Server-side reads for the desktop web pages that aren't vendor listings
// (those go through lib/vendor-query.ts). Everything here is a direct query
// against the same Prisma models the mobile API routes read.

import { prisma } from '@/lib/prisma'
import { EXPERIENCE_STOPS_INCLUDE, hostVendor, routeMinutes, routeRatings, stopViews } from '@/lib/experience-stops'
import { areaForNeighborhood } from '@/lib/areas'
import { queryVendors } from '@/lib/vendor-query'

export interface ExperienceCardData {
  id: string
  name: string
  tagline: string
  price: number
  imageUrl: string
  videoUrl: string | null
  city: string
  startLocation: string
  travelTime: number
  travelMode: string
  vendorId: string | null
  vendorName: string | null
  stopCount: number
  moods: Array<{ id: string; name: string; icon: string }>
  accessibility: string[]
  /** Average of the hosting vendor's real reviews — experiences have no reviews of their own. */
  rating: number | null
  reviewCount: number
}

export interface PhotoSpotData {
  id: string
  name: string
  description: string
  bestTime: string
  officialPhoto: string
  gallery: string[]
  videos: string[]
  city: string
  lat: number
  lng: number
  momentCount: number
  topLikes: number
}

function avg(ratings: number[]): number | null {
  if (ratings.length === 0) return null
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
}

export async function getExperiences(opts: { city?: 'NEGRIL' | 'MONTEGO_BAY'; ids?: string[] } = {}): Promise<ExperienceCardData[]> {
  const rows = await prisma.experience.findMany({
    where: {
      ...(opts.city ? { city: opts.city } : {}),
      ...(opts.ids ? { id: { in: opts.ids } } : {})
    },
    orderBy: { createdAt: 'desc' },
    include: {
      moods: { select: { id: true, name: true, icon: true } },
      ...EXPERIENCE_STOPS_INCLUDE
    }
  })
  return rows.map(e => {
    const ratings = routeRatings(e.stops)
    const host = hostVendor(e.stops)
    return {
      id: e.id,
      name: e.name,
      tagline: e.tagline,
      price: e.price,
      imageUrl: e.imageUrl,
      videoUrl: e.videoUrl,
      city: e.city,
      startLocation: e.startLocation,
      travelTime: e.travelTime,
      travelMode: e.travelMode,
      vendorId: host?.id ?? null,
      vendorName: host?.name ?? null,
      stopCount: e.stops.length,
      moods: e.moods,
      accessibility: e.accessibility,
      rating: avg(ratings),
      reviewCount: ratings.length
    }
  })
}

export async function getExperience(id: string) {
  const e = await prisma.experience.findUnique({
    where: { id },
    include: {
      moods: { select: { id: true, name: true, icon: true, description: true } },
      ...EXPERIENCE_STOPS_INCLUDE
    }
  })
  if (!e) return null
  const { stops, ...rest } = e
  return {
    ...rest,
    /** First vendor on the route, shown as the host. */
    vendor: hostVendor(stops),
    ratings: routeRatings(stops),
    stops: stopViews(stops),
    totalMinutes: routeMinutes(stops)
  }
}

export async function getPhotoSpots(opts: { city?: 'NEGRIL' | 'MONTEGO_BAY'; bestTimes?: string[] } = {}): Promise<PhotoSpotData[]> {
  const rows = await prisma.photoSpot.findMany({
    where: {
      ...(opts.city ? { city: opts.city } : {}),
      ...(opts.bestTimes?.length ? { bestTime: { in: opts.bestTimes } } : {})
    },
    orderBy: { createdAt: 'asc' },
    include: { userPhotos: { select: { likes: true } } }
  })
  return rows.map(toPhotoSpotData)
}

function toPhotoSpotData(s: Omit<PhotoSpotData, 'momentCount' | 'topLikes'> & { userPhotos: { likes: number }[] }): PhotoSpotData {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    bestTime: s.bestTime,
    officialPhoto: s.officialPhoto,
    gallery: s.gallery,
    videos: s.videos,
    city: s.city,
    lat: s.lat,
    lng: s.lng,
    momentCount: s.userPhotos.length,
    topLikes: s.userPhotos.reduce((m, p) => Math.max(m, p.likes), 0)
  }
}

export async function getPhotoSpot(id: string): Promise<PhotoSpotData | null> {
  const s = await prisma.photoSpot.findUnique({ where: { id }, include: { userPhotos: { select: { likes: true } } } })
  return s ? toPhotoSpotData(s) : null
}

/** "Best" = most traveler moments and likes; ties fall back to seeded order. */
export function rankPhotoSpots(spots: PhotoSpotData[]): PhotoSpotData[] {
  return [...spots].sort((a, b) => b.momentCount - a.momentCount || b.topLikes - a.topLikes)
}

export async function getVendorDetail(id: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, avatarUrl: true } } }
      },
      experienceStops: { select: { experience: { select: { id: true, name: true, tagline: true, price: true, imageUrl: true } } } },
      flashDeals: { where: { expires: { gt: new Date() } }, orderBy: { expires: 'asc' } }
    }
  })
  if (!vendor || !vendor.visibleInMarketplace) return null
  const ratings = vendor.reviews.map(r => r.rating)
  const { experienceStops, ...rest } = vendor
  return {
    ...rest,
    // Experiences whose route stops here, each once.
    experiences: Array.from(new Map(experienceStops.map(s => [s.experience.id, s.experience])).values()),
    area: areaForNeighborhood(vendor.neighborhood, vendor.city),
    rating: avg(ratings),
    reviewCount: ratings.length
  }
}

export { formatCity } from '@/lib/format'

/**
 * Featured Destinations: exactly mobile Home's set and order — premium
 * vendors with video, as /api/vendors orders them (premium, then newest).
 * Exempt from the editorial display priority.
 */
export async function getFeaturedVendors() {
  const rows = await prisma.vendor.findMany({
    where: { visibleInMarketplace: true, isTransport: false, isPremium: true, videos: { isEmpty: false } },
    orderBy: [{ isPremium: 'desc' }, { createdAt: 'desc' }],
    select: { id: true, name: true, category: true, neighborhood: true, city: true, videos: true, images: true, live: true, whoThere: true }
  })
  return rows.map(v => ({
    id: v.id,
    name: v.name,
    category: v.category,
    area: areaForNeighborhood(v.neighborhood, v.city),
    video: v.videos[0],
    image: v.images[0] ?? null,
    live: v.live,
    whoThere: v.whoThere
  }))
}

// Mobile Home renames two moods and assigns these icons; the web picker matches it.
const MOOD_RENAMES: Record<string, string> = { 'Out Til Sunrise': 'Party Time', 'Golden Hour': 'Sunset Chaser' }
const MOOD_ICONS: Record<string, string> = {
  'R&R': 'spa', 'Just The Two Of Us': 'heart', 'Party Time': 'party', 'Sunset Chaser': 'sun', 'Water Life': 'wave',
  'Street Food Crawl': 'food', 'Hangover Cures': 'recharge', 'Solo Missions': 'user', 'Family Day': 'users', 'Rum & Bass': 'glass'
}

export async function getVibeMoods() {
  const moods = await prisma.mood.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, icon: true, description: true } })
  return moods.map(m => {
    const name = MOOD_RENAMES[m.name] ?? m.name
    return { id: m.id, name, icon: MOOD_ICONS[name] ?? m.icon, description: m.description }
  })
}

/** Cover image for a guide panel: its pinned vendor's thumbnail, else the first vendor image in the area. */
export async function getGuideCover(coverVendor: string | undefined, fallback: Array<{ image: string | null }>): Promise<string | null> {
  if (coverVendor) {
    // Reads the per-request vendor catalog — no extra database query.
    const { items } = await queryVendors({}, { prioritize: false })
    const pinned = items.find(v => v.name === coverVendor)
    if (pinned?.image) return pinned.image
  }
  return fallback.find(x => x.image)?.image ?? null
}
