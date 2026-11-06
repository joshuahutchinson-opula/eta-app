// lib/home.ts — Home's "today in <town>", computed on the server for the
// selected region (app/api/home):
//   daypart     from the real sun at the town (lib/daypart.ts)
//   hero        a photo or short muted loop of the town for the daypart
//               (TownMedia, uploaded in the vendor app), else the town's
//               best vendor photo; on a party night, that event instead
//   featured    B.O.N and promoted vendors, open now or soon, weighted by the
//               daypart, with a little shuffle so it's different each open.
//               On a cruise day, only places you can reach and be back from
//               before all aboard.
//   moods       Choose The Vibe, the daypart's moods first
//   feed        whether the Vibe feed has enough fresh video (/vibe)
// Your day (signed in) is yourDay() below; the feed itself is lib/vibe-feed.ts.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { daypartScore, orderMoods, sunInfo, type Daypart } from '@/lib/daypart'
import { openNow, type OpenNow } from '@/lib/hours'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { townFor, type CityCode } from '@/lib/regions'
import { vibeFeedCount, FEED_MIN_VIDEOS } from '@/lib/vibe-feed'
import { estimateMinutes, haversineKm, type LatLng } from '@/lib/routing'

const FEATURED_MAX = 8
/** Interested people that make an event a "big night" without the flag. */
const BIG_NIGHT_INTEREST = 15

const openRank = (o: OpenNow) => (o.state === 'open' ? 2 : o.state === 'soon' ? 1 : o.state === 'unknown' ? 0.5 : 0)

/** A stable pick for the day: the same one all day, a different one tomorrow. */
function dayPick<T>(items: T[], seed: string): T | null {
  if (!items.length) return null
  const h = crypto.createHash('sha1').update(seed).digest().readUInt32BE(0)
  return items[h % items.length]
}

/** Minutes from now until "HH:MM" Jamaica time (past midnight counts as tomorrow). */
export function minutesUntil(hhmm: string, now = new Date()): number {
  const local = new Date(now.getTime() - 5 * 3600000)
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes()
  const [h, m] = hhmm.split(':').map(Number)
  let d = h * 60 + m - mins
  if (d < 0) d += 24 * 60
  return d
}

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
  /** Up to five photos, for the long-press preview. */
  images: string[]
  video: string | null
  live: boolean
  whoThere: number
  bon: boolean
  promoted: boolean
  open: OpenNow
  /** Set when it closes within the hour: "Closes in 40 min". */
  closesInMin: number | null
  /** Cruise day: minutes from the port by road. */
  minutesFromPort?: number
  lat: number
  lng: number
}

export interface CruiseLimit { port: LatLng; backBy: Date }

async function featured(city: CityCode, daypart: Daypart, now: Date, cruise?: CruiseLimit | null): Promise<FeaturedItem[]> {
  const rows = await prisma.vendor.findMany({
    where: { city, visibleInMarketplace: true, isTransport: false, OR: [{ isPremium: true }, { promotedUntil: { gt: now } }] },
    select: VENDOR_CARD
  })
  const left = cruise ? (cruise.backBy.getTime() - now.getTime()) / 60000 : Infinity
  return rows
    .map(v => ({ v, open: openNow(v.hours, now), away: cruise ? estimateMinutes(haversineKm(cruise.port, v), 'TAXI') : 0 }))
    // Only places open now or soon (no hours listed: can't rule them out).
    .filter(({ v, open }) => open.state !== 'closed' && (v.images.length || v.videos.length))
    // Cruise day: there, an hour there, and back to the ship with half an hour to spare.
    .filter(({ away }) => away * 2 + 60 + 30 <= left)
    .map(({ v, open, away }) => ({
      v, open, away,
      score: daypartScore(daypart, v) * 2 + openRank(open) * 3 + (v.videos.length ? 1 : 0) + (v.live ? 1 : 0) + Math.random() * 2.5 - (cruise ? away / 20 : 0)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, FEATURED_MAX)
    .map(({ v, open, away }) => {
      const closesIn = open.state === 'open' && open.closes ? minutesUntil(open.closes, now) : null
      return {
        id: v.id, name: v.name, category: v.category, neighborhood: v.neighborhood, description: v.description,
        image: v.images[0] ?? null, images: v.images.slice(0, 5), video: v.videos[0] ?? null, live: v.live, whoThere: v.whoThere,
        bon: v.isPremium, promoted: Boolean(v.promotedUntil && v.promotedUntil > now), open,
        closesInMin: closesIn !== null && closesIn <= 60 ? closesIn : null,
        ...(cruise ? { minutesFromPort: away } : {}),
        lat: v.lat, lng: v.lng
      }
    })
}

// ---------- Hero ----------

export interface HeroMedia {
  kind: 'photo' | 'video'
  url: string
  poster: string | null
  credit: string | null
  /** "town" = TownMedia for this daypart; "vendor" = the town's best vendor photo. */
  source: 'town' | 'vendor'
}

async function heroMedia(city: CityCode, daypart: Daypart, now: Date): Promise<HeroMedia | null> {
  const rows = await prisma.townMedia.findMany({ where: { city: city as never, daypart, active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] })
  const pick = dayPick(rows, `${city}:${jamaicaDayKey(now)}:${daypart}`)
  if (pick) return { kind: pick.kind === 'video' ? 'video' : 'photo', url: pick.url, poster: pick.poster, credit: pick.credit, source: 'town' }
  // No media yet: the town's best vendor photo, leaning to the daypart.
  const vendors = await prisma.vendor.findMany({
    where: { city, visibleInMarketplace: true, isTransport: false, images: { isEmpty: false } },
    select: { id: true, name: true, category: true, description: true, images: true, isPremium: true, _count: { select: { reviews: true } } },
    take: 60
  })
  const best = vendors
    .map(v => ({ v, s: daypartScore(daypart, v) + (v.isPremium ? 4 : 0) + Math.min(v._count.reviews, 20) / 5 }))
    .sort((a, b) => b.s - a.s)[0]?.v
  return best ? { kind: 'photo', url: best.images[0], poster: null, credit: best.name, source: 'vendor' } : null
}

export interface PartyNight {
  id: string
  title: string
  venueName: string
  startAt: Date
  video: string | null
  image: string | null
  bookable: boolean
}

/** Tonight's big event in the town (flagged bigNight, or lots of interest), from mid-afternoon until it ends. */
async function partyNight(city: CityCode, now: Date): Promise<PartyNight | null> {
  const day = jamaicaDayKey(now)
  const dayStart = new Date(Date.parse(`${day}T00:00:00-05:00`))
  const evening = new Date(dayStart.getTime() + 17 * 3600000)
  const lateNight = new Date(dayStart.getTime() + 30 * 3600000)
  if (now.getTime() < dayStart.getTime() + 15 * 3600000) return null
  const events = await prisma.event.findMany({
    where: { city, startAt: { gte: evening, lt: lateNight }, OR: [{ endAt: null }, { endAt: { gt: now } }] },
    select: { id: true, title: true, venueName: true, startAt: true, videoUrl: true, imageUrl: true, inAppTickets: true, ticketUrl: true, bigNight: true, _count: { select: { interests: true } } }
  })
  const big = events
    .filter(e => (e.bigNight || e._count.interests >= BIG_NIGHT_INTEREST) && (e.videoUrl || e.imageUrl))
    .sort((a, b) => Number(b.bigNight) - Number(a.bigNight) || b._count.interests - a._count.interests)[0]
  return big ? { id: big.id, title: big.title, venueName: big.venueName, startAt: big.startAt, video: big.videoUrl, image: big.imageUrl, bookable: big.inAppTickets || Boolean(big.ticketUrl) } : null
}

// ---------- Home ----------

export async function homeToday(city: CityCode, now = new Date(), cruise?: CruiseLimit | null) {
  const town = townFor(city)
  const sun = sunInfo(town.lat, town.lng, now)
  const [items, hero, party, moods, feedCount] = await Promise.all([
    featured(city, sun.daypart, now, cruise),
    heroMedia(city, sun.daypart, now),
    partyNight(city, now),
    prisma.mood.findMany({ select: { id: true, name: true, icon: true, description: true, coverImage: true }, orderBy: { createdAt: 'asc' } }),
    vibeFeedCount(city, now)
  ])
  return {
    town: { city, name: town.name, lat: town.lat, lng: town.lng },
    sun: { daypart: sun.daypart, sunrise: sun.sunrise, sunset: sun.sunset, goldenStart: sun.goldenStart, goldenEnd: sun.goldenEnd, nextChange: sun.nextChange },
    hero,
    party,
    featured: items,
    moods: orderMoods(sun.daypart, moods),
    feed: { enabled: feedCount >= FEED_MIN_VIDEOS, count: feedCount }
  }
}

/** For the "What's new" toast after a refresh: stories and events posted in the town since then. */
export async function whatsNew(city: CityCode, since: Date) {
  const [stories, events] = await Promise.all([
    prisma.story.count({ where: { hidden: false, createdAt: { gt: since }, expiresAt: { gt: new Date() }, OR: [{ city: city as never }, { vendor: { city } }] } }),
    prisma.event.count({ where: { city, createdAt: { gt: since }, startAt: { gt: new Date() } } })
  ])
  return { stories, events }
}

// ---------- Your day ----------

export interface DayItem {
  kind: 'booking' | 'ticket' | 'stop' | 'ride'
  id: string
  title: string
  place: string | null
  /** When it starts; null for an untimed trip stop. */
  at: Date | null
  /** Roughly when it's over, for the free gaps. */
  endsAt: Date | null
  lat: number | null
  lng: number | null
  href: string
  image: string | null
  /** What the QR on the Ticket screen holds (a ticket code or the booking reference). */
  qr: string | null
  /** "ticket" (green "Ticket ✓"), "booked", "planned" (a trip stop not booked yet). */
  status: 'ticket' | 'booked' | 'planned'
  /** Group trips: who's coming. */
  crew: Array<{ name: string; avatarUrl: string | null }>
}

export interface DayRecap {
  places: number
  points: number
  photos: string[]
  vendorIds: string[]
}

/** "HH:MM" on a Jamaica day → the instant. */
function atLocal(day: string, hhmm: string | null | undefined): Date | null {
  if (!hhmm || !/^\d{1,2}:\d{2}$/.test(hhmm)) return null
  const [y, m, d] = day.split('-').map(Number)
  const [h, mi] = hhmm.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, h, mi) + 5 * 3600000)
}

const HOUR = 3600000

/**
 * What the signed-in traveler has on today (Jamaica day): confirmed
 * bookings (rides too), event tickets and the stops of a trip planned for
 * today, in order. `upcoming` drops what started over an hour ago; `recap`
 * is today's check-ins (places, points, photos) for the night recap once
 * the last plan is done.
 */
export async function yourDay(userId: string, now = new Date()): Promise<{ items: DayItem[]; upcoming: DayItem[]; recap: DayRecap; next: DayItem | null; then: DayItem | null }> {
  const day = jamaicaDayKey(now)
  const start = new Date(atLocal(day, '00:00')!.getTime())
  const end = new Date(start.getTime() + 86400000)
  const [bookings, tickets, trips, checkIns] = await Promise.all([
    prisma.booking.findMany({
      where: { userId, status: 'CONFIRMED', date: { gte: start, lt: end } },
      select: {
        id: true, date: true, time: true, pickup: true, dropoff: true,
        experience: { select: { name: true, meetingPoint: true, meetingLat: true, meetingLng: true, startLocation: true, imageUrl: true, stops: { select: { plannedDuration: true } } } },
        vendor: { select: { name: true, neighborhood: true, lat: true, lng: true, images: true } },
        accommodation: { select: { name: true, lat: true, lng: true } },
        transferService: { select: { vehicle: true } },
        trip: { select: { slug: true, status: true, members: { select: { name: true, user: { select: { avatarUrl: true } } } } } }
      }
    }),
    prisma.ticket.findMany({
      where: { userId, status: 'CONFIRMED', event: { startAt: { gte: start, lt: end } } },
      select: { id: true, code: true, event: { select: { id: true, title: true, venueName: true, startAt: true, endAt: true, lat: true, lng: true, imageUrl: true } } }
    }),
    prisma.trip.findMany({
      // A trip's date is a plain day (stored at UTC midnight) or a full
      // timestamp; read wide and match the day below.
      where: { date: { gte: new Date(start.getTime() - 86400000), lt: new Date(end.getTime() + 86400000) }, status: { in: ['PLANNING', 'BOOKED'] }, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: {
        slug: true, name: true, date: true, status: true,
        members: { select: { name: true, user: { select: { avatarUrl: true } } } },
        stops: { orderBy: { order: 'asc' }, select: { id: true, time: true, vendor: { select: { name: true, neighborhood: true, lat: true, lng: true, images: true } }, experience: { select: { name: true, meetingLat: true, meetingLng: true, meetingPoint: true, imageUrl: true } }, photoSpot: { select: { name: true, lat: true, lng: true, officialPhoto: true } } } }
      }
    }),
    prisma.checkIn.findMany({
      where: { userId, createdAt: { gte: start, lt: end } },
      select: { points: true, vendorId: true, photoSpotId: true, vendor: { select: { images: true } }, photoSpot: { select: { officialPhoto: true } } }
    })
  ])

  const crewOf = (members: Array<{ name: string; user: { avatarUrl: string | null } | null }>) =>
    members.length > 1 ? members.map(m => ({ name: m.name.split(' ')[0], avatarUrl: m.user?.avatarUrl ?? null })) : []

  const items: DayItem[] = []
  for (const b of bookings) {
    const at = atLocal(day, b.time) ?? b.date
    const crew = b.trip ? crewOf(b.trip.members) : []
    if (b.transferService) {
      items.push({ kind: 'ride', id: b.id, title: b.dropoff ? `${b.pickup ?? ''} → ${b.dropoff}`.trim() : b.transferService.vehicle, place: b.pickup, at, endsAt: new Date(at.getTime() + HOUR), lat: null, lng: null, href: '/bookings', image: b.vendor?.images[0] ?? null, qr: b.id, status: 'booked', crew })
    } else if (b.experience) {
      const mins = b.experience.stops.reduce((s, st) => s + (st.plannedDuration ?? 0), 0) || 180
      items.push({ kind: 'booking', id: b.id, title: b.experience.name, place: b.experience.meetingPoint ?? b.experience.startLocation, at, endsAt: new Date(at.getTime() + mins * 60000), lat: b.experience.meetingLat, lng: b.experience.meetingLng, href: b.trip?.status === 'BOOKED' ? `/experiences?trip=${b.trip.slug}` : '/bookings', image: b.experience.imageUrl, qr: b.id, status: 'booked', crew })
    } else if (b.vendor) {
      items.push({ kind: 'booking', id: b.id, title: b.vendor.name, place: b.vendor.neighborhood, at, endsAt: new Date(at.getTime() + 2 * HOUR), lat: b.vendor.lat, lng: b.vendor.lng, href: '/bookings', image: b.vendor.images[0] ?? null, qr: b.id, status: 'booked', crew })
    } else if (b.accommodation) {
      items.push({ kind: 'booking', id: b.id, title: b.accommodation.name, place: null, at, endsAt: new Date(at.getTime() + HOUR), lat: b.accommodation.lat, lng: b.accommodation.lng, href: "/bookings", image: null, qr: b.id, status: 'booked', crew })
    }
  }
  for (const tk of tickets) {
    items.push({ kind: 'ticket', id: tk.id, title: tk.event.title, place: tk.event.venueName, at: tk.event.startAt, endsAt: tk.event.endAt ?? new Date(tk.event.startAt.getTime() + 4 * HOUR), lat: tk.event.lat, lng: tk.event.lng, href: `/events/${tk.event.id}`, image: tk.event.imageUrl, qr: tk.code, status: 'ticket', crew: [] })
  }
  const tripDay = (d: Date) => (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 ? d.toISOString().slice(0, 10) : jamaicaDayKey(d))
  for (const trip of trips.filter(tr => tr.date && tripDay(tr.date) === day)) {
    const crew = crewOf(trip.members)
    for (const s of trip.stops) {
      const name = s.vendor?.name ?? s.experience?.name ?? s.photoSpot?.name
      if (!name) continue
      const lat = s.vendor?.lat ?? s.experience?.meetingLat ?? s.photoSpot?.lat ?? null
      const lng = s.vendor?.lng ?? s.experience?.meetingLng ?? s.photoSpot?.lng ?? null
      const at = atLocal(day, s.time)
      items.push({ kind: 'stop', id: s.id, title: name, place: s.vendor?.neighborhood ?? s.experience?.meetingPoint ?? trip.name, at, endsAt: at ? new Date(at.getTime() + HOUR) : null, lat, lng, href: `/experiences?trip=${trip.slug}`, image: s.vendor?.images[0] ?? s.experience?.imageUrl ?? s.photoSpot?.officialPhoto ?? null, qr: null, status: trip.status === 'BOOKED' ? 'booked' : 'planned', crew })
    }
  }

  // Timed things in order, untimed trip stops after them in trip order.
  const sorted = items.sort((a, b) => (a.at ? a.at.getTime() : Infinity) - (b.at ? b.at.getTime() : Infinity))
  const cutoff = now.getTime() - HOUR
  const upcoming = sorted.filter(i => !i.at || i.at.getTime() >= cutoff)
  const photos = checkIns.map(c => c.vendor?.images[0] ?? c.photoSpot?.officialPhoto ?? null).filter((u): u is string => Boolean(u))
  const recap: DayRecap = {
    places: new Set(checkIns.map(c => c.vendorId ?? c.photoSpotId).filter(Boolean)).size,
    points: checkIns.reduce((s, c) => s + c.points, 0),
    photos: Array.from(new Set(photos)).slice(0, 4),
    vendorIds: Array.from(new Set(checkIns.map(c => c.vendorId).filter((v): v is string => Boolean(v))))
  }
  return { items: sorted, upcoming, recap, next: upcoming[0] ?? null, then: upcoming[1] ?? null }
}
