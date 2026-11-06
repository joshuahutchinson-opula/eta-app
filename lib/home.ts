// lib/home.ts — Home's "today in <town>", computed on the server for the
// selected region (app/api/home):
//   daypart     from the real sun at the town (lib/daypart.ts)
//   featured    B.O.N and promoted vendors, open now or soon, weighted by the
//               daypart, with a little shuffle so it's different each open
//   story       today's TodayStory, or one built from a featured vendor
//   moods       Choose The Vibe, the daypart's moods first
//   feed        whether the Vibe feed has enough fresh video to show
// Your day (signed in) is yourDay() below; the feed itself is lib/vibe-feed.ts.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { daypartScore, orderMoods, sunInfo, type Daypart } from '@/lib/daypart'
import { openNow, type OpenNow } from '@/lib/hours'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { townFor, type CityCode } from '@/lib/regions'
import { vibeFeedCount, FEED_MIN_VIDEOS } from '@/lib/vibe-feed'

const FEATURED_MAX = 8

const openRank = (o: OpenNow) => (o.state === 'open' ? 2 : o.state === 'soon' ? 1 : o.state === 'unknown' ? 0.5 : 0)

// ---------- Featured ----------

const VENDOR_CARD = {
  id: true, name: true, category: true, neighborhood: true, city: true, priceRange: true, description: true,
  images: true, videos: true, live: true, whoThere: true, isPremium: true, promotedUntil: true, hours: true, lat: true, lng: true
} as const

export interface FeaturedItem {
  id: string
  name: string
  category: string
  neighborhood: string
  description: string
  image: string | null
  video: string | null
  live: boolean
  whoThere: number
  bon: boolean
  promoted: boolean
  open: OpenNow
  lat: number
  lng: number
}

async function featured(city: CityCode, daypart: Daypart, now: Date): Promise<FeaturedItem[]> {
  const rows = await prisma.vendor.findMany({
    where: { city, visibleInMarketplace: true, isTransport: false, OR: [{ isPremium: true }, { promotedUntil: { gt: now } }] },
    select: VENDOR_CARD
  })
  return rows
    .map(v => ({ v, open: openNow(v.hours, now) }))
    // Only places open now or soon (no hours listed: can't rule them out).
    .filter(({ v, open }) => open.state !== 'closed' && (v.images.length || v.videos.length))
    .map(({ v, open }) => ({
      v, open,
      score: daypartScore(daypart, v) * 2 + openRank(open) * 3 + (v.videos.length ? 1 : 0) + (v.live ? 1 : 0) + Math.random() * 2.5
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, FEATURED_MAX)
    .map(({ v, open }) => ({
      id: v.id, name: v.name, category: v.category, neighborhood: v.neighborhood, description: v.description,
      image: v.images[0] ?? null, video: v.videos[0] ?? null, live: v.live, whoThere: v.whoThere,
      bon: v.isPremium, promoted: Boolean(v.promotedUntil && v.promotedUntil > now), open, lat: v.lat, lng: v.lng
    }))
}

// ---------- Today story ----------

export type StoryBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'quote'; text: string; by?: string }

export interface TodayStoryView {
  id: string
  /** Built from a vendor because nothing was published for today. */
  auto: boolean
  eyebrow: string | null
  title: string
  dek: string
  /** For an auto story: which headline template the app uses (by category). */
  template: string | null
  coverImage: string
  coverVideo: string | null
  body: StoryBlock[]
  vendor: { id: string; name: string; category: string; neighborhood: string; image: string | null; lat: number; lng: number; open: OpenNow } | null
  event: { id: string; title: string; venueName: string; startAt: Date; imageUrl: string | null; lat: number | null; lng: number | null; bookable: boolean } | null
}

export function parseBlocks(value: unknown): StoryBlock[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((b): StoryBlock[] => {
    if (!b || typeof b !== 'object') return []
    const o = b as Record<string, unknown>
    if (o.type === 'text' && typeof o.text === 'string') return [{ type: 'text', text: o.text }]
    if (o.type === 'image' && typeof o.url === 'string') return [{ type: 'image', url: o.url, ...(typeof o.caption === 'string' ? { caption: o.caption } : {}) }]
    if (o.type === 'quote' && typeof o.text === 'string') return [{ type: 'quote', text: o.text, ...(typeof o.by === 'string' ? { by: o.by } : {}) }]
    return []
  })
}

const STORY_VENDOR = { id: true, name: true, category: true, neighborhood: true, images: true, lat: true, lng: true, hours: true } as const
const STORY_EVENT = { id: true, title: true, venueName: true, startAt: true, imageUrl: true, lat: true, lng: true, inAppTickets: true, ticketUrl: true } as const

/** A stable pick for the day: the same story all day, a different one tomorrow. */
function dayPick<T>(items: T[], seed: string): T | null {
  if (!items.length) return null
  const h = crypto.createHash('sha1').update(seed).digest().readUInt32BE(0)
  return items[h % items.length]
}

async function todayStory(city: CityCode, now: Date): Promise<TodayStoryView | null> {
  const day = jamaicaDayKey(now)
  const s = await prisma.todayStory.findFirst({
    where: { city, publishOn: day, published: true },
    include: { vendor: { select: STORY_VENDOR }, event: { select: STORY_EVENT } }
  })
  if (s) {
    return {
      id: s.id, auto: false, eyebrow: s.eyebrow, title: s.title, dek: s.dek, template: null,
      coverImage: s.coverImage, coverVideo: s.coverVideo, body: parseBlocks(s.body),
      vendor: s.vendor ? { id: s.vendor.id, name: s.vendor.name, category: s.vendor.category, neighborhood: s.vendor.neighborhood, image: s.vendor.images[0] ?? null, lat: s.vendor.lat, lng: s.vendor.lng, open: openNow(s.vendor.hours, now) } : null,
      event: s.event ? { id: s.event.id, title: s.event.title, venueName: s.event.venueName, startAt: s.event.startAt, imageUrl: s.event.imageUrl, lat: s.event.lat, lng: s.event.lng, bookable: s.event.inAppTickets || Boolean(s.event.ticketUrl) } : null
    }
  }

  // Nothing published: build one from a featured (B.O.N or promoted) vendor
  // with photos — its media, description, best dish and best reviews.
  const candidates = await prisma.vendor.findMany({
    where: { city, visibleInMarketplace: true, isTransport: false, isMock: false, OR: [{ isPremium: true }, { promotedUntil: { gt: now } }], images: { isEmpty: false } },
    select: { ...STORY_VENDOR, description: true, videos: true, dishOfDay: true },
    orderBy: { id: 'asc' }
  })
  const pool = candidates.length ? candidates : await prisma.vendor.findMany({
    where: { city, visibleInMarketplace: true, isTransport: false, images: { isEmpty: false } },
    select: { ...STORY_VENDOR, description: true, videos: true, dishOfDay: true },
    orderBy: { id: 'asc' }
  })
  const v = dayPick(pool, `${city}:${day}`)
  if (!v) return null
  const [dish, reviews] = await Promise.all([
    prisma.menuItem.findFirst({ where: { vendorId: v.id, available: true }, orderBy: [{ imageUrl: { sort: 'desc', nulls: 'last' } }, { sortOrder: 'asc' }], select: { name: true, description: true, imageUrl: true } }),
    prisma.review.findMany({ where: { vendorId: v.id, hidden: false, rating: { gte: 4 }, comment: { not: null } }, orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }], take: 2, select: { comment: true, user: { select: { name: true } } } })
  ])
  const special = v.dishOfDay && typeof v.dishOfDay === 'object' && !Array.isArray(v.dishOfDay) ? v.dishOfDay as { name?: string; imageUrl?: string } : null
  const paragraphs = v.description.split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z])/).map(p => p.trim()).filter(Boolean)
  const body: StoryBlock[] = []
  body.push({ type: 'text', text: paragraphs.slice(0, 2).join(' ') || v.description })
  if (v.images[1]) body.push({ type: 'image', url: v.images[1] })
  if (paragraphs.length > 2) body.push({ type: 'text', text: paragraphs.slice(2).join(' ') })
  const dishName = special?.name ?? dish?.name
  const dishImage = special?.imageUrl ?? dish?.imageUrl
  if (dishName) {
    body.push({ type: 'text', text: dish?.description && !special?.name ? `${dishName}: ${dish.description}` : dishName })
    if (dishImage) body.push({ type: 'image', url: dishImage, caption: dishName })
  }
  for (const r of reviews) if (r.comment) body.push({ type: 'quote', text: r.comment, by: r.user.name.split(' ')[0] })
  if (v.images[2]) body.push({ type: 'image', url: v.images[2] })
  return {
    id: `auto_${v.id}_${day}`, auto: true, eyebrow: null, title: v.name, dek: paragraphs[0] ?? v.description.slice(0, 140),
    template: v.category, coverImage: v.images[0], coverVideo: v.videos[0] ?? null, body,
    vendor: { id: v.id, name: v.name, category: v.category, neighborhood: v.neighborhood, image: v.images[0] ?? null, lat: v.lat, lng: v.lng, open: openNow(v.hours, now) },
    event: null
  }
}

// ---------- Home ----------

export async function homeToday(city: CityCode, now = new Date()) {
  const town = townFor(city)
  const sun = sunInfo(town.lat, town.lng, now)
  const [items, story, moods, feedCount] = await Promise.all([
    featured(city, sun.daypart, now),
    todayStory(city, now),
    prisma.mood.findMany({ select: { id: true, name: true, icon: true, description: true, coverImage: true }, orderBy: { createdAt: 'asc' } }),
    vibeFeedCount(city, now)
  ])
  return {
    town: { city, name: town.name, lat: town.lat, lng: town.lng },
    sun: { daypart: sun.daypart, sunrise: sun.sunrise, sunset: sun.sunset, goldenStart: sun.goldenStart, goldenEnd: sun.goldenEnd, nextChange: sun.nextChange },
    featured: items,
    story,
    moods: orderMoods(sun.daypart, moods),
    feed: { enabled: feedCount >= FEED_MIN_VIDEOS, count: feedCount }
  }
}

// ---------- Your day ----------

export interface DayItem {
  kind: 'booking' | 'ticket' | 'stop'
  id: string
  title: string
  place: string | null
  /** When it starts; null for an untimed trip stop. */
  at: Date | null
  lat: number | null
  lng: number | null
  href: string
}

/** "HH:MM" on a Jamaica day → the instant. */
function atLocal(day: string, hhmm: string | null | undefined): Date | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null
  const [y, m, d] = day.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h, mi) + 5 * 3600000)
}

/**
 * What the signed-in traveler has on today (Jamaica day): confirmed
 * bookings, event tickets and the stops of a trip planned for today. Returns
 * what's next and the one after; things that started over an hour ago drop off.
 */
export async function yourDay(userId: string, now = new Date()): Promise<{ next: DayItem | null; then: DayItem | null }> {
  const day = jamaicaDayKey(now)
  const start = new Date(atLocal(day, '00:00')!.getTime())
  const end = new Date(start.getTime() + 86400000)
  const [bookings, tickets, trips] = await Promise.all([
    prisma.booking.findMany({
      where: { userId, status: 'CONFIRMED', date: { gte: start, lt: end } },
      select: {
        id: true, date: true, time: true,
        experience: { select: { name: true, meetingPoint: true, meetingLat: true, meetingLng: true, startLocation: true } },
        vendor: { select: { name: true, neighborhood: true, lat: true, lng: true } },
        accommodation: { select: { name: true, lat: true, lng: true } },
        trip: { select: { slug: true, status: true } }
      }
    }),
    prisma.ticket.findMany({
      where: { userId, status: 'CONFIRMED', event: { startAt: { gte: start, lt: end } } },
      select: { id: true, event: { select: { id: true, title: true, venueName: true, startAt: true, lat: true, lng: true } } }
    }),
    prisma.trip.findMany({
      // A trip's date is a plain day (stored at UTC midnight) or a full
      // timestamp; read wide and match the day below.
      where: { date: { gte: new Date(start.getTime() - 86400000), lt: new Date(end.getTime() + 86400000) }, status: { in: ['PLANNING', 'BOOKED'] }, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: {
        slug: true, name: true, date: true,
        stops: { orderBy: { order: 'asc' }, select: { id: true, time: true, vendor: { select: { name: true, neighborhood: true, lat: true, lng: true } }, experience: { select: { name: true, meetingLat: true, meetingLng: true, meetingPoint: true } }, photoSpot: { select: { name: true, lat: true, lng: true } } } }
      }
    })
  ])

  const items: DayItem[] = []
  for (const b of bookings) {
    const at = atLocal(day, b.time) ?? b.date
    if (b.experience) items.push({ kind: 'booking', id: b.id, title: b.experience.name, place: b.experience.meetingPoint ?? b.experience.startLocation, at, lat: b.experience.meetingLat, lng: b.experience.meetingLng, href: b.trip?.status === 'BOOKED' ? `/experiences?trip=${b.trip.slug}` : '/bookings' })
    else if (b.vendor) items.push({ kind: 'booking', id: b.id, title: b.vendor.name, place: b.vendor.neighborhood, at, lat: b.vendor.lat, lng: b.vendor.lng, href: '/bookings' })
    else if (b.accommodation) items.push({ kind: 'booking', id: b.id, title: b.accommodation.name, place: null, at, lat: b.accommodation.lat, lng: b.accommodation.lng, href: '/bookings' })
  }
  for (const tk of tickets) items.push({ kind: 'ticket', id: tk.id, title: tk.event.title, place: tk.event.venueName, at: tk.event.startAt, lat: tk.event.lat, lng: tk.event.lng, href: `/events/${tk.event.id}` })
  const tripDay = (d: Date) => (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? d.toISOString().slice(0, 10) : jamaicaDayKey(d))
  for (const trip of trips.filter(tr => tr.date && tripDay(tr.date) === day)) {
    for (const s of trip.stops) {
      const name = s.vendor?.name ?? s.experience?.name ?? s.photoSpot?.name
      if (!name) continue
      const lat = s.vendor?.lat ?? s.experience?.meetingLat ?? s.photoSpot?.lat ?? null
      const lng = s.vendor?.lng ?? s.experience?.meetingLng ?? s.photoSpot?.lng ?? null
      items.push({ kind: 'stop', id: s.id, title: name, place: s.vendor?.neighborhood ?? s.experience?.meetingPoint ?? trip.name, at: atLocal(day, s.time), lat, lng, href: `/experiences?trip=${trip.slug}` })
    }
  }

  const cutoff = now.getTime() - 3600000
  const upcoming = items
    .filter(i => !i.at || i.at.getTime() >= cutoff)
    // Timed things in order, untimed trip stops after them in trip order.
    .sort((a, b) => (a.at ? a.at.getTime() : Infinity) - (b.at ? b.at.getTime() : Infinity))
  return { next: upcoming[0] ?? null, then: upcoming[1] ?? null }
}
