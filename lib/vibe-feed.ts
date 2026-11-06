// lib/vibe-feed.ts — "Watch <town> now": the full-screen vertical video feed
// for a region (app/vibe, /api/vibe). Sources, all from the last 14 days:
//   vendor     videos on a vendor's listing (Vendor.videosUpdatedAt)
//   event      promo videos for events coming up (or posted) in that window
//   story      vendor and traveler stories with video, while they're live
//   instagram  vendor-approved Instagram mentions with video, while live
// Stories and Instagram mentions keep their 24-hour promise: they're only
// in the feed while they'd still show in the story rings.
// The feed (and every way into it) only shows when a region has at least
// FEED_MIN_VIDEOS of these; otherwise Home works without it.
import { prisma } from '@/lib/prisma'
import { daypartScore, sunInfo } from '@/lib/daypart'
import { openNow, type OpenNow } from '@/lib/hours'
import { townFor, type CityCode } from '@/lib/regions'

export const FEED_MIN_VIDEOS = 8
const WINDOW_MS = 14 * 86400000
const PER_VENDOR = 2
const FEED_MAX = 40

export interface VibeItem {
  id: string
  source: 'vendor' | 'event' | 'story' | 'instagram'
  src: string
  poster: string | null
  name: string
  /** Vendor category, or "EVENT". */
  category: string
  lat: number | null
  lng: number | null
  open: OpenNow | null
  /** Events: when it starts. */
  startAt: Date | null
  /** Where View goes and what Save saves. */
  target: { kind: 'vendor' | 'event'; id: string } | null
  by: string | null
  postedAt: Date
}

const VENDOR = { id: true, name: true, category: true, description: true, lat: true, lng: true, hours: true, images: true } as const

async function sources(city: CityCode, now: Date) {
  const since = new Date(now.getTime() - WINDOW_MS)
  const until = new Date(now.getTime() + WINDOW_MS)
  return Promise.all([
    prisma.vendor.findMany({
      where: { city, visibleInMarketplace: true, isTransport: false, videos: { isEmpty: false }, videosUpdatedAt: { gte: since } },
      select: { ...VENDOR, videos: true, videosUpdatedAt: true }
    }),
    prisma.event.findMany({
      where: { city, videoUrl: { not: null }, OR: [{ startAt: { gte: now, lte: until } }, { startAt: { lte: now }, endAt: { gte: now } }] },
      select: { id: true, title: true, description: true, videoUrl: true, imageUrl: true, lat: true, lng: true, startAt: true, createdAt: true, venueName: true }
    }),
    prisma.story.findMany({
      where: { videoUrl: { not: null }, hidden: false, expiresAt: { gt: now }, createdAt: { gte: since }, OR: [{ vendor: { city } }, { vendorId: null, city }] },
      select: {
        id: true, videoUrl: true, imageUrl: true, createdAt: true, eventId: true,
        vendor: { select: VENDOR }, placeVendor: { select: VENDOR }, user: { select: { name: true } }
      }
    }),
    prisma.instagramMention.findMany({
      where: { status: 'APPROVED', mediaType: 'video', expiresAt: { gt: now }, receivedAt: { gte: since }, vendor: { city } },
      select: { id: true, mediaUrl: true, receivedAt: true, igUsername: true, vendor: { select: VENDOR } }
    })
  ])
}

/** How many fresh videos the region has (decides whether the feed shows). */
export async function vibeFeedCount(city: CityCode, now = new Date()): Promise<number> {
  const [vendors, events, stories, mentions] = await sources(city, now)
  return vendors.reduce((n, v) => n + Math.min(v.videos.length, PER_VENDOR), 0) + events.length + stories.length + mentions.length
}

export async function vibeFeed(city: CityCode, now = new Date()): Promise<{ enabled: boolean; items: VibeItem[] }> {
  const town = townFor(city)
  const { daypart } = sunInfo(town.lat, town.lng, now)
  const [vendors, events, stories, mentions] = await sources(city, now)

  const scored: Array<{ item: VibeItem; score: number }> = []
  const place = (v: { id: string; name: string; category: string; description: string; lat: number; lng: number; hours: unknown }) => ({ open: openNow(v.hours, now), fit: daypartScore(daypart, v) })
  const openBoost = (o: OpenNow | null) => (!o ? 0 : o.state === 'open' ? 6 : o.state === 'soon' ? 3 : o.state === 'unknown' ? 1 : -4)
  const fresh = (d: Date) => 2 * (1 - Math.min(1, (now.getTime() - d.getTime()) / WINDOW_MS))

  for (const v of vendors) {
    const { open, fit } = place(v)
    v.videos.slice(0, PER_VENDOR).forEach((src, i) => scored.push({
      item: { id: `v_${v.id}_${i}`, source: 'vendor', src, poster: v.images[i] ?? v.images[0] ?? null, name: v.name, category: v.category, lat: v.lat, lng: v.lng, open, startAt: null, target: { kind: 'vendor', id: v.id }, by: null, postedAt: v.videosUpdatedAt! },
      score: fit + openBoost(open) + fresh(v.videosUpdatedAt!) - i
    }))
  }
  for (const e of events) {
    const hoursAway = (e.startAt.getTime() - now.getTime()) / 3600000
    const soon = hoursAway < 0 ? 5 : hoursAway < 6 ? 5 : hoursAway < 24 ? 3 : 1
    scored.push({
      item: { id: `e_${e.id}`, source: 'event', src: e.videoUrl!, poster: e.imageUrl, name: e.title, category: 'EVENT', lat: e.lat, lng: e.lng, open: null, startAt: e.startAt, target: { kind: 'event', id: e.id }, by: e.venueName, postedAt: e.createdAt },
      score: soon + daypartScore(daypart, { name: e.title, description: e.description, category: daypart === 'night' ? 'DRINKS' : null })
    })
  }
  for (const s of stories) {
    const v = s.vendor ?? s.placeVendor
    const p = v ? place(v) : null
    scored.push({
      item: {
        id: `s_${s.id}`, source: 'story', src: s.videoUrl!, poster: s.imageUrl, name: v?.name ?? town.name, category: v?.category ?? 'OTHER', lat: v?.lat ?? null, lng: v?.lng ?? null,
        open: p?.open ?? null, startAt: null, target: v ? { kind: 'vendor', id: v.id } : s.eventId ? { kind: 'event', id: s.eventId } : null,
        by: s.user ? s.user.name.split(' ')[0] : null, postedAt: s.createdAt
      },
      score: (p ? p.fit + openBoost(p.open) : 1) + fresh(s.createdAt) + 1
    })
  }
  for (const m of mentions) {
    const p = place(m.vendor)
    scored.push({
      item: { id: `ig_${m.id}`, source: 'instagram', src: m.mediaUrl, poster: m.vendor.images[0] ?? null, name: m.vendor.name, category: m.vendor.category, lat: m.vendor.lat, lng: m.vendor.lng, open: p.open, startAt: null, target: { kind: 'vendor', id: m.vendor.id }, by: `@${m.igUsername}`, postedAt: m.receivedAt },
      score: p.fit + openBoost(p.open) + fresh(m.receivedAt) + 1
    })
  }

  const items = scored.sort((a, b) => b.score - a.score).slice(0, FEED_MAX).map(s => s.item)
  return { enabled: scored.length >= FEED_MIN_VIDEOS, items }
}
