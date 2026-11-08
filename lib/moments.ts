// lib/moments.ts — what the Experiences tab leads with right now in a town
// (app/api/experiences/moments). The tab changes with the time of day and
// the weather:
//   mode      morning | afternoon | golden | night from the real sun at the
//             town (lib/daypart.ts), or "rain" when the next hours look wet
//             (Open-Meteo, lib/weather.ts) — then indoor spots lead and
//             outdoor ones drop back.
//   hero      up to 3 moments for the big swipeable card
//   upNext    the rest, ordered by start time
//   parties   Parties & Happenings: "Tonight", or "Right Now" at night
//
// How a moment is picked, in order of strength:
//   1. ETA admin hand-picks for the town (MomentPick) lead, in their order.
//   2. Vendor tags on each experience: best time (Experience.bestTimes —
//      empty = worked out from its start times and the real sunset),
//      indoor/outdoor, start times and spots per slot.
//   3. The weather forecast at the slot's time, and the sunset.
//   4. Paid "Featured" placement (Experience.featuredUntil, always labelled).
//   5. Ranking signals: reviews, QR check-ins at the host around that hour
//      of day, bookings made today.
//   6. The traveler's Plan My Day answers (vibe, time budget, group size).
import { prisma } from '@/lib/prisma'
import { sunInfo, type Daypart } from '@/lib/daypart'
import { rainChance } from '@/lib/weather'
import { PLAN_B_RAIN_THRESHOLD, isOutdoor } from '@/lib/plan-b'
import { slotStates } from '@/lib/slots'
import { bookedTodayByExperience } from '@/lib/booking-counts'
import { jamaicaDateTime } from '@/lib/pricing'
import { jamaicaDayKey, addDays } from '@/lib/trip-dates'
import { townFor, type CityCode } from '@/lib/regions'
import { rollMockEvents } from '@/lib/mock-events-roll'

export type MomentMode = Daypart | 'rain'
export const MOMENT_MODES: MomentMode[] = ['morning', 'afternoon', 'golden', 'night', 'rain']

export interface MomentPrefs {
  /** The Plan My Day vibe (a mood name). */
  mood?: string | null
  /** The time budget: 2hr | half | full | night. */
  time?: string | null
  crew?: number | null
}

export interface Moment {
  kind: 'experience' | 'event'
  id: string
  title: string
  place: string
  image: string | null
  video: string | null
  startAt: string
  endAt: string | null
  /** Started and not over (events), or starting within 15 minutes. */
  live: boolean
  tomorrow: boolean
  lat: number | null
  lng: number | null
  /** Per person (experiences) or per ticket. Null = not listed. */
  price: number | null
  isFree: boolean
  inAppTickets: boolean
  ticketUrl: string | null
  /** Start time "HH:MM" for experiences (what Reserve books). */
  time: string | null
  spotsLeft: number | null
  social: { kind: 'booked' | 'going'; n: number }
  indoor: boolean
  featured: boolean
  picked: boolean
  note: string | null
}

export interface PartyItem { id: string; title: string; venue: string; startAt: string; endAt: string | null; live: boolean; price: number | null; isFree: boolean; image: string | null }

export interface MomentsData {
  town: { city: CityCode; name: string; lat: number; lng: number }
  mode: MomentMode
  daypart: Daypart
  rain: boolean
  sunset: string
  hero: Moment[]
  upNext: Moment[]
  parties: { when: 'tonight' | 'now'; items: PartyItem[] }
}

const HOUR = 3600000
const HERO_MAX = 3
const NEXT_MAX = 8

const NEXT_PART: Record<Daypart, Daypart> = { morning: 'afternoon', afternoon: 'golden', golden: 'night', night: 'morning' }

function hourOfDay(d: Date): number {
  return new Date(d.getTime() - 5 * HOUR).getUTCHours()
}

interface Candidate { m: Moment; score: number; pickOrder: number | null }

export async function momentsFor(city: CityCode, prefs: MomentPrefs = {}, now = new Date()): Promise<MomentsData> {
  const town = townFor(city)
  const sun = sunInfo(town.lat, town.lng, now)
  const rainNow = await rainChance(city, now, 3).catch(() => null)
  const rain = rainNow !== null && rainNow >= PLAN_B_RAIN_THRESHOLD
  const mode: MomentMode = rain ? 'rain' : sun.daypart
  const today = jamaicaDayKey(now)
  const tomorrow = addDays(today, 1)

  await rollMockEvents().catch(() => {})
  const [experiences, events, picks, bookedToday] = await Promise.all([
    prisma.experience.findMany({
      where: { city },
      select: {
        id: true, name: true, tagline: true, price: true, imageUrl: true, videoUrl: true, startTimes: true, capacityPerSlot: true, maxPartySize: true,
        outdoor: true, bestTimes: true, featuredUntil: true, meetingLat: true, meetingLng: true, meetingPoint: true, startLocation: true, travelTime: true,
        moods: { select: { name: true } },
        reviews: { where: { hidden: false }, select: { rating: true } },
        stops: { orderBy: { order: 'asc' }, select: { stopType: true, vendor: { select: { id: true, name: true, category: true, lat: true, lng: true, indoor: true } } } }
      }
    }),
    prisma.event.findMany({
      where: { city, startAt: { gte: new Date(now.getTime() - 8 * HOUR), lt: new Date(now.getTime() + 30 * HOUR) } },
      select: {
        id: true, title: true, venueName: true, startAt: true, endAt: true, price: true, isFree: true, imageUrl: true, videoUrl: true, videos: true, photos: true,
        lat: true, lng: true, inAppTickets: true, ticketUrl: true, bigNight: true,
        _count: { select: { interests: true, tickets: true } }
      }
    }),
    prisma.momentPick.findMany({
      where: { city, active: true, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
      orderBy: { sortOrder: 'asc' }
    }),
    bookedTodayByExperience()
  ])

  const pickFor = (kind: 'experience' | 'event', id: string) => picks.find(p =>
    (kind === 'experience' ? p.experienceId === id : p.eventId === id) &&
    (!p.daypart || p.daypart === mode || p.daypart === sun.daypart))

  // QR check-ins at each host vendor over 60 days, by hour of day.
  const hostIds = experiences.map(e => e.stops.find(s => s.vendor)?.vendor?.id).filter((x): x is string => Boolean(x))
  const checkIns = hostIds.length ? await prisma.checkIn.findMany({
    where: { vendorId: { in: hostIds }, method: 'qr', createdAt: { gte: new Date(now.getTime() - 60 * 24 * HOUR) } },
    select: { vendorId: true, createdAt: true },
    take: 5000
  }) : []
  const checkInsAround = (vendorId: string | undefined, at: Date) => {
    if (!vendorId) return 0
    const h = hourOfDay(at)
    return checkIns.filter(c => c.vendorId === vendorId && Math.abs(hourOfDay(c.createdAt) - h) <= 1).length
  }

  const crew = Math.max(1, Math.min(30, prefs.crew ?? 1))
  const moodName = prefs.mood?.toLowerCase() ?? null
  const candidates: Candidate[] = []

  // ---------- Experiences: their next start time ----------
  for (const e of experiences) {
    const host = e.stops.find(s => s.vendor)?.vendor ?? null
    const indoor = !isOutdoor({ outdoor: e.outdoor, stops: e.stops as never })
    let slot: { date: string; time: string; at: Date } | null = null
    for (const day of [today, tomorrow]) {
      const times = e.startTimes.length ? [...e.startTimes].sort() : ['10:00', '13:00', '15:00']
      for (const time of times) {
        const at = jamaicaDateTime(day, time)
        if (!at || at.getTime() < now.getTime() - 10 * 60000) continue
        slot = { date: day, time, at }
        break
      }
      if (slot) break
    }
    if (!slot) continue
    const states = e.capacityPerSlot ? await slotStates(e.id, slot.date).catch(() => []) : []
    const state = states.find(s => s.time === slot!.time)
    if (state?.closed || state?.soldOut) continue
    const spotsLeft = state?.left ?? null
    const slotPart = sunInfo(town.lat, town.lng, slot.at).daypart
    const fitsNow = e.bestTimes.length ? e.bestTimes.includes(sun.daypart) : slotPart === sun.daypart
    const fitsNext = e.bestTimes.length ? e.bestTimes.includes(NEXT_PART[sun.daypart]) : slotPart === NEXT_PART[sun.daypart]
    const hoursAway = (slot.at.getTime() - now.getTime()) / HOUR
    const isTomorrow = slot.date !== today
    const featured = Boolean(e.featuredUntil && e.featuredUntil.getTime() > now.getTime())
    const ratings = e.reviews.map(r => r.rating)
    const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0
    const pick = pickFor('experience', e.id)

    let score = 0
    if (fitsNow) score += 6
    else if (fitsNext) score += 2
    if (hoursAway <= 1) score += 4
    else if (hoursAway <= 3) score += 3
    else if (hoursAway <= 6) score += 1
    if (isTomorrow) score -= 6
    if (rain) score += indoor ? 8 : -10
    else if (!indoor) {
      // Rain forecast for later: outdoor slots that look wet drop back.
      const later = await rainChance(city, slot.at, 2).catch(() => null)
      if (later !== null && later >= PLAN_B_RAIN_THRESHOLD) score -= 6
    }
    if (featured) score += 4
    score += avg * 0.8 + Math.min(ratings.length, 30) / 10
    score += Math.min(checkInsAround(host?.id, slot.at), 20) / 4
    score += Math.min(bookedToday.get(e.id) ?? 0, 20) / 5
    if (moodName && e.moods.some(m => m.name.toLowerCase() === moodName)) score += 4
    if (prefs.time === 'night' && (slotPart === 'night' || slotPart === 'golden')) score += 3
    if (prefs.time === '2hr' && e.travelTime <= 20) score += 1
    if ((spotsLeft !== null && crew > spotsLeft) || (e.maxPartySize && crew > e.maxPartySize)) score -= 20

    candidates.push({
      score,
      pickOrder: pick ? pick.sortOrder : null,
      m: {
        kind: 'experience', id: e.id, title: e.name, place: e.meetingPoint || host?.name || e.startLocation,
        image: e.imageUrl || null, video: e.videoUrl, startAt: slot.at.toISOString(), endAt: null,
        live: hoursAway <= 0.25 && hoursAway >= -0.2, tomorrow: isTomorrow,
        lat: e.meetingLat ?? host?.lat ?? null, lng: e.meetingLng ?? host?.lng ?? null,
        price: e.price, isFree: e.price === 0, inAppTickets: false, ticketUrl: null, time: slot.time,
        spotsLeft, social: { kind: 'booked', n: bookedToday.get(e.id) ?? 0 }, indoor, featured, picked: Boolean(pick), note: pick?.note ?? null
      }
    })
  }

  // ---------- Events ----------
  const eventEnd = (ev: (typeof events)[number]) => ev.endAt ?? new Date(ev.startAt.getTime() + 4 * HOUR)
  const liveEvents = events.filter(ev => eventEnd(ev).getTime() > now.getTime())
  for (const ev of liveEvents) {
    const live = ev.startAt.getTime() <= now.getTime()
    const hoursAway = (ev.startAt.getTime() - now.getTime()) / HOUR
    const isTomorrow = jamaicaDayKey(ev.startAt) !== today && hourOfDay(ev.startAt) >= 6
    const evening = hourOfDay(ev.startAt) >= 17 || hourOfDay(ev.startAt) < 4
    const pick = pickFor('event', ev.id)
    let score = 0
    if (live) score += 6
    else if (hoursAway <= 2) score += 4
    else if (hoursAway <= 5) score += 2
    if ((sun.daypart === 'night' || sun.daypart === 'golden') && evening) score += 5
    if (sun.daypart === 'morning' && evening) score -= 2
    if (isTomorrow) score -= 6
    if (ev.bigNight) score += 3
    score += Math.min(ev._count.interests + ev._count.tickets, 60) / 10
    if (prefs.time === 'night' && evening) score += 3
    candidates.push({
      score,
      pickOrder: pick ? pick.sortOrder : null,
      m: {
        kind: 'event', id: ev.id, title: ev.title, place: ev.venueName,
        image: ev.imageUrl ?? ev.photos[0] ?? null, video: ev.videoUrl ?? ev.videos[0] ?? null,
        startAt: ev.startAt.toISOString(), endAt: ev.endAt?.toISOString() ?? null, live, tomorrow: isTomorrow,
        lat: ev.lat, lng: ev.lng, price: ev.isFree ? 0 : ev.price, isFree: ev.isFree, inAppTickets: ev.inAppTickets, ticketUrl: ev.ticketUrl, time: null,
        spotsLeft: null, social: { kind: 'going', n: ev._count.interests + ev._count.tickets }, indoor: false, featured: false, picked: Boolean(pick), note: pick?.note ?? null
      }
    })
  }

  // Hand-picks first (in their order), then the best score.
  const ordered = candidates.sort((a, b) => {
    if (a.pickOrder !== null || b.pickOrder !== null) {
      if (a.pickOrder === null) return 1
      if (b.pickOrder === null) return -1
      return a.pickOrder - b.pickOrder
    }
    return b.score - a.score
  })
  const todayFirst = ordered.filter(c => !c.m.tomorrow)
  const hero = (todayFirst.length ? todayFirst : ordered).slice(0, HERO_MAX).map(c => c.m)
  const heroIds = new Set(hero.map(m => `${m.kind}:${m.id}`))
  const rest = ordered.filter(c => !heroIds.has(`${c.m.kind}:${c.m.id}`))
  // Up Next: what's still to come, in time order — in the rain, the dry ones first.
  const upNext = rest
    .filter(c => !rain || c.m.indoor || c.m.kind === 'event')
    .map(c => c.m)
    .sort((a, b) => Number(a.tomorrow) - Number(b.tomorrow) || Date.parse(a.startAt) - Date.parse(b.startAt))
    .slice(0, NEXT_MAX)

  // Parties & Happenings: at night what's on right now (or within 3h); otherwise tonight's.
  const night = sun.daypart === 'night'
  const dayStart = Date.parse(`${today}T00:00:00-05:00`)
  const partyPool = liveEvents
    .filter(ev => !heroIds.has(`event:${ev.id}`))
    .filter(ev => night
      ? ev.startAt.getTime() <= now.getTime() + 3 * HOUR
      : ev.startAt.getTime() >= dayStart + 17 * HOUR && ev.startAt.getTime() < dayStart + 30 * HOUR)
    .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
    .slice(0, 3)
  return {
    town: { city, name: town.name, lat: town.lat, lng: town.lng },
    mode,
    daypart: sun.daypart,
    rain,
    sunset: sun.sunset.toISOString(),
    hero,
    upNext,
    parties: {
      when: night ? 'now' : 'tonight',
      items: partyPool.map(ev => ({
        id: ev.id, title: ev.title, venue: ev.venueName, startAt: ev.startAt.toISOString(), endAt: ev.endAt?.toISOString() ?? null,
        live: ev.startAt.getTime() <= now.getTime(), price: ev.isFree ? 0 : ev.price, isFree: ev.isFree, image: ev.imageUrl ?? ev.photos[0] ?? null
      }))
    }
  }
}
