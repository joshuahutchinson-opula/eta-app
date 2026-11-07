// lib/home-stage.ts — what the top of Home shows for a trip stage
// (lib/stage.ts), on the server (app/api/home/stage):
//   countdown  "On During Your Trip" (events on their dates, in their towns),
//              "Book Ahead" (experiences that sell out: "6 spots left" /
//              "Fully booked <date>"), the gift waiting when they land, and
//              for a returning traveler going back to a town they know,
//              "Places You Haven't Tried" and "Saved Last Time"
//   cruise     rides back to the port (transport vendors in the port town)
import { prisma } from '@/lib/prisma'
import { rollMockEvents } from '@/lib/mock-events-roll'
import { addDays, jamaicaDayStart } from '@/lib/trip-dates'
import { welcomeBackRewardFor, welcomeRewardFor } from '@/lib/welcome'
import type { CityCode } from '@/lib/regions'

const keyOf = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Jamaica' })
const BOOK_AHEAD_LEFT = 10

export interface BookAheadItem {
  id: string
  name: string
  image: string
  price: number
  /** Fewest spots left on any trip day (null when one is fully booked). */
  spotsLeft: number | null
  /** The first trip day it's fully booked. */
  fullyBooked: string | null
}

async function bookAhead(cities: CityCode[], start: string, end: string): Promise<BookAheadItem[]> {
  const exps = await prisma.experience.findMany({
    where: { city: { in: cities }, capacityPerSlot: { not: null }, NOT: { startTimes: { isEmpty: true } } },
    select: { id: true, name: true, imageUrl: true, price: true, startTimes: true, capacityPerSlot: true },
    take: 24
  })
  if (!exps.length) return []
  const days: string[] = []
  for (let d = start; d <= end && days.length < 14; d = addDays(d, 1)) days.push(d)
  const from = jamaicaDayStart(days[0])
  const to = new Date(jamaicaDayStart(days[days.length - 1]).getTime() + 86400000)
  const [bookings, overrides] = await Promise.all([
    prisma.booking.findMany({ where: { experienceId: { in: exps.map(e => e.id) }, status: { not: 'CANCELLED' }, date: { gte: from, lt: to } }, select: { experienceId: true, time: true, partySize: true, date: true } }),
    prisma.experienceSlot.findMany({ where: { experienceId: { in: exps.map(e => e.id) }, date: { in: days } } })
  ])
  const out: BookAheadItem[] = []
  for (const e of exps) {
    let least: number | null = null
    let full: string | null = null
    for (const day of days) {
      let dayLeft = 0
      for (const time of e.startTimes) {
        const o = overrides.find(x => x.experienceId === e.id && x.date === day && x.time === time)
        if (o?.closed) continue
        const cap = o?.capacity ?? e.capacityPerSlot ?? 0
        const taken = bookings.filter(b => b.experienceId === e.id && b.time === time && keyOf(b.date) === day).reduce((n, b) => n + b.partySize, 0)
        dayLeft += Math.max(0, cap - taken)
      }
      if (dayLeft === 0 && !full) full = day
      least = least === null ? dayLeft : Math.min(least, dayLeft)
    }
    if (full) out.push({ id: e.id, name: e.name, image: e.imageUrl, price: e.price, spotsLeft: null, fullyBooked: full })
    else if (least !== null && least <= BOOK_AHEAD_LEFT) out.push({ id: e.id, name: e.name, image: e.imageUrl, price: e.price, spotsLeft: least, fullyBooked: null })
  }
  return out.sort((a, b) => (a.spotsLeft ?? -1) - (b.spotsLeft ?? -1)).slice(0, 8)
}

export async function countdownExtras(input: { cities: CityCode[]; start: string; end: string; userId: string | null; returning: boolean; visitedTown: boolean }) {
  const from = jamaicaDayStart(input.start)
  const to = new Date(jamaicaDayStart(input.end).getTime() + 86400000)
  const city = input.cities[0]
  await rollMockEvents()
  const lifetime = input.userId ? (await prisma.user.findUnique({ where: { id: input.userId }, select: { lifetimePoints: true } }))?.lifetimePoints ?? 0 : 0
  const [events, ahead, gift] = await Promise.all([
    prisma.event.findMany({
      where: { city: { in: input.cities }, startAt: { gte: from, lt: to } },
      orderBy: { startAt: 'asc' },
      take: 12,
      select: { id: true, title: true, venueName: true, startAt: true, imageUrl: true, isFree: true, price: true, city: true, vendor: { select: { images: true } } }
    }),
    bookAhead(input.cities, input.start, input.end),
    (input.returning ? welcomeBackRewardFor(city, null, lifetime) : Promise.resolve(null)).then(r => r ?? welcomeRewardFor(city))
  ])

  let notTried: Array<{ id: string; name: string; image: string | null; category: string; neighborhood: string }> = []
  let savedLast: typeof notTried = []
  if (input.userId && input.visitedTown) {
    const [visited, saved] = await Promise.all([
      prisma.checkIn.findMany({ where: { userId: input.userId, vendorId: { not: null } }, select: { vendorId: true }, distinct: ['vendorId'] }),
      prisma.saved.findMany({ where: { userId: input.userId, kind: 'VENDOR' }, select: { refId: true } })
    ])
    const been = visited.map(v => v.vendorId!).filter(Boolean)
    const card = { id: true, name: true, images: true, category: true, neighborhood: true } as const
    const [fresh, savedRows] = await Promise.all([
      prisma.vendor.findMany({ where: { city: { in: input.cities }, visibleInMarketplace: true, isTransport: false, id: { notIn: been }, images: { isEmpty: false } }, orderBy: [{ isPremium: 'desc' }, { whoThere: 'desc' }], take: 10, select: card }),
      saved.length ? prisma.vendor.findMany({ where: { id: { in: saved.map(s => s.refId) }, city: { in: input.cities } }, take: 10, select: card }) : Promise.resolve([])
    ])
    const shape = (v: { id: string; name: string; images: string[]; category: string; neighborhood: string }) => ({ id: v.id, name: v.name, image: v.images[0] ?? null, category: v.category, neighborhood: v.neighborhood })
    notTried = fresh.map(shape)
    savedLast = savedRows.map(shape)
  }

  return {
    events: events.map(e => ({ id: e.id, title: e.title, venueName: e.venueName, startAt: e.startAt, imageUrl: e.imageUrl ?? e.vendor?.images[0] ?? null, isFree: e.isFree, price: e.price, city: e.city })),
    bookAhead: ahead,
    gift: gift ? { id: gift.id, name: gift.name, description: gift.description, welcomeBack: input.returning } : null,
    notTried,
    savedLast
  }
}

/** Cruise day: rides back to the port, pinned. */
export async function cruiseExtras(port: CityCode) {
  const rides = await prisma.vendor.findMany({
    where: { city: port, isTransport: true, visibleInMarketplace: true },
    select: { id: true, name: true, images: true, phone: true, whatsapp: true, neighborhood: true },
    orderBy: [{ isPremium: 'desc' }, { name: 'asc' }],
    take: 4
  })
  return { rides: rides.map(r => ({ id: r.id, name: r.name, image: r.images[0] ?? null, phone: r.phone, whatsapp: r.whatsapp, neighborhood: r.neighborhood })) }
}
