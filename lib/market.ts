// lib/market.ts — everything the Market tab shows for a town, built on the
// server in one go (app/api/market). Sections, in their chapters:
//   Today's Picks  B.O.N Members (premium vendors + their perk), Dishes of
//                  the Day (Vendor.dishOfDay, with its short video), Deals Right Now (live vendor
//                  perks from Rewards + quiet-hour boosts running now)
//   Around You     Near You Now (the client sorts `vendors` by distance),
//                  Local Favourites (ranked by locals' QR check-ins in the
//                  last 90 days, each with a local's own words)
//   Food & Drink   Jerk Spots (tag "jerk", heat 1–4), Rum Bars & Beach Bars
//                  (with happy hour), Open Late (open past 10pm tonight:
//                  open now first, latest closing first)
//   Shop & Stay    Crafts & Souvenirs, Accommodation, Groceries & Essentials
//   Everything     All Vendors
// Vendors join sections through Vendor.marketTags (lib/market-tags.ts).
// Every list can be empty; the tab hides empty sections.
import { prisma } from '@/lib/prisma'
import { parseHours, DAYS, openNow, type OpenNow } from '@/lib/hours'
import { todaysBoosts } from '@/lib/boosts'
import { capsLeft } from '@/lib/vouchers'
import { townFor, cityName, type CityCode } from '@/lib/regions'
import { SECTION_TAGS } from '@/lib/market-tags'

const DAY = 86400000
const LATE_FROM_MIN = 22 * 60
const LATE_SOON_MS = 4 * 3600000
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }

export interface MkVendor {
  id: string
  name: string
  category: string
  neighborhood: string
  image: string | null
  lat: number | null
  lng: number | null
  priceRange: string
  isPremium: boolean
  tags: string[]
  note: string | null
  heat: number | null
  happyHour: { start: string; end: string } | null
  open: OpenNow
  rating: number | null
  reviews: number
}

export interface MkDish { vendorId: string; vendorName: string; name: string; price: number | null; image: string | null; video: string | null; note: string | null }
export type MkDeal =
  | { kind: 'perk'; id: string; vendorId: string; vendorName: string; title: string; cost: number; leftToday: number }
  | { kind: 'boost'; id: string; vendorId: string; vendorName: string; multiplier: number; endsAt: string | null }
export interface MkLocalFav { vendorId: string; quote: string; author: string; authorTown: string | null; local: boolean; checkIns: number }
export interface MkLate { vendorId: string; opensAt: string; closesAt: string; openNow: boolean }
export interface MkStay { id: string; name: string; type: string; images: string[]; nightlyPrice: number | null; priceRange: string; amenities: string[]; partner: { code: string; name: string } | null }
export interface MkBon { vendorId: string; perk: string | null }

export interface MarketData {
  town: { city: CityCode; name: string; lat: number; lng: number }
  vendors: MkVendor[]
  bon: MkBon[]
  dishes: MkDish[]
  deals: MkDeal[]
  localFavs: MkLocalFav[]
  jerk: string[]
  bars: string[]
  openLate: MkLate[]
  crafts: string[]
  stays: MkStay[]
  essentials: string[]
}

/** Jamaica's day of the week and the instant of its midnight. */
function jamaicaClock(now: Date) {
  const local = new Date(now.getTime() - 5 * 3600000)
  return { day: local.getUTCDay(), midnight: Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 5 * 3600000 }
}

/**
 * Tonight's late range for a vendor: a range that's open past 10pm (or past
 * midnight). Covers the range running now from last night too (after
 * midnight). Null when it doesn't stay open late.
 */
export function lateRange(hours: unknown, now = new Date()): { opensAt: Date; closesAt: Date } | null {
  const h = parseHours(hours)
  if (!h) return null
  const { day, midnight } = jamaicaClock(now)
  const candidates: Array<{ opensAt: Date; closesAt: Date }> = []
  for (const offset of [-1, 0]) {
    const ranges = h[DAYS[(day + offset + 7) % 7]] ?? []
    const base = midnight + offset * DAY
    for (const [a, b] of ranges) {
      const start = toMin(a)
      let end = toMin(b)
      if (end <= start) end += 1440
      if (end <= LATE_FROM_MIN) continue
      const opensAt = new Date(base + start * 60000)
      const closesAt = new Date(base + end * 60000)
      if (closesAt.getTime() <= now.getTime()) continue
      // Yesterday's range only counts while it's still running.
      if (offset === -1 && opensAt.getTime() > now.getTime()) continue
      candidates.push({ opensAt, closesAt })
    }
  }
  return candidates.sort((x, y) => x.opensAt.getTime() - y.opensAt.getTime())[0] ?? null
}

const VENDOR_SELECT = {
  id: true, name: true, category: true, neighborhood: true, images: true, lat: true, lng: true, priceRange: true, isPremium: true,
  marketTags: true, marketNote: true, heatLevel: true, happyHourStart: true, happyHourEnd: true, hours: true, dishOfDay: true,
  reviews: { where: { hidden: false }, select: { rating: true } }
} as const

export async function marketFor(city: CityCode, now = new Date()): Promise<MarketData> {
  const town = townFor(city)
  const [rows, stays, rewards, boosts, localCheckIns] = await Promise.all([
    prisma.vendor.findMany({ where: { city, visibleInMarketplace: true, isTransport: false }, select: VENDOR_SELECT }),
    prisma.accommodation.findMany({
      where: { city },
      orderBy: [{ vetted: 'desc' }, { googleStars: 'desc' }],
      select: { id: true, name: true, type: true, media: true, nightlyPrice: true, priceRange: true, amenities: true, partner: { select: { code: true, name: true, active: true } } }
    }),
    prisma.reward.findMany({
      where: { active: true, kind: 'catalog', audience: 'all', category: 'vendor', OR: [{ city: null }, { city }], vendors: { some: { vendor: { city } } } },
      orderBy: [{ sortOrder: 'asc' }, { cost: 'asc' }],
      select: { id: true, name: true, cost: true, dailyCap: true, monthlyBudget: true, vendors: { where: { vendor: { city } }, select: { vendor: { select: { id: true, name: true } } } } },
      take: 12
    }),
    todaysBoosts(city, now.getTime()).catch(() => []),
    prisma.checkIn.groupBy({
      by: ['vendorId'],
      where: { method: 'qr', vendorId: { not: null }, createdAt: { gte: new Date(now.getTime() - 90 * DAY) }, user: { travelerType: 'LOCAL' }, vendor: { city } },
      _count: { _all: true }
    })
  ])

  const vendors: MkVendor[] = rows.map(v => {
    const ratings = v.reviews.map(r => r.rating)
    return {
      id: v.id, name: v.name, category: v.category, neighborhood: v.neighborhood, image: v.images[0] ?? null,
      lat: v.lat, lng: v.lng, priceRange: v.priceRange, isPremium: v.isPremium, tags: v.marketTags, note: v.marketNote,
      heat: v.heatLevel ? Math.max(1, Math.min(4, v.heatLevel)) : null,
      happyHour: v.happyHourStart && v.happyHourEnd ? { start: v.happyHourStart, end: v.happyHourEnd } : null,
      open: openNow(v.hours, now),
      rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
      reviews: ratings.length
    }
  })
  const byId = new Map(vendors.map(v => [v.id, v]))
  const checkIns = new Map(localCheckIns.map(c => [c.vendorId as string, c._count._all]))
  // Best first: locals' check-ins, then rating weighted by how many reviews.
  const rank = (a: MkVendor, b: MkVendor) =>
    (checkIns.get(b.id) ?? 0) - (checkIns.get(a.id) ?? 0) ||
    (b.rating ?? 0) * Math.min(b.reviews, 20) - (a.rating ?? 0) * Math.min(a.reviews, 20) ||
    a.name.localeCompare(b.name)
  const tagged = (tags: readonly string[]) => vendors.filter(v => v.tags.some(t => tags.includes(t))).sort(rank).map(v => v.id)

  // B.O.N members, each with a perk they honour (or their own line).
  const perkByVendor = new Map<string, string>()
  for (const r of rewards) for (const rv of r.vendors) if (!perkByVendor.has(rv.vendor.id)) perkByVendor.set(rv.vendor.id, r.name)
  const bon = vendors.filter(v => v.isPremium).sort(rank).map(v => ({ vendorId: v.id, perk: perkByVendor.get(v.id) ?? v.note }))

  // Dishes of the day.
  const dishes: MkDish[] = rows
    .filter(v => v.dishOfDay && typeof v.dishOfDay === 'object' && typeof (v.dishOfDay as { name?: unknown }).name === 'string')
    .map(v => {
      const d = v.dishOfDay as { name: string; price?: number | null; imageUrl?: string | null; videoUrl?: string | null; note?: string | null }
      return { vendorId: v.id, vendorName: v.name, name: d.name, price: typeof d.price === 'number' ? d.price : null, image: d.imageUrl || v.images[0] || null, video: d.videoUrl || null, note: d.note ?? null }
    })

  // Deals right now: live quiet-hour boosts first (they run out), then vendor perks with some left today.
  const liveBoosts: MkDeal[] = boosts
    .filter(b => b.kind === 'quiet_hour' && b.live && b.vendor)
    .map(b => ({ kind: 'boost' as const, id: b.id, vendorId: b.vendor!.id, vendorName: b.vendor!.name, multiplier: b.multiplier, endsAt: b.endsAt }))
  const perks: MkDeal[] = []
  for (const r of rewards) {
    const v = r.vendors[0]?.vendor
    if (!v) continue
    const left = await capsLeft(r)
    if (left.today <= 0 || left.month <= 0) continue
    perks.push({ kind: 'perk', id: r.id, vendorId: v.id, vendorName: v.name, title: r.name, cost: r.cost, leftToday: left.today })
  }

  // Local favourites: most checked-in by locals, told in a local's own words.
  const favIds = Array.from(checkIns.entries()).sort((a, b) => b[1] - a[1]).map(([id]) => id).filter(id => byId.has(id)).slice(0, 8)
  const quotes = favIds.length ? await prisma.review.findMany({
    where: { vendorId: { in: favIds }, hidden: false, comment: { not: null }, user: { travelerType: 'LOCAL' } },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    select: { vendorId: true, comment: true, user: { select: { name: true, city: true } } }
  }) : []
  const localFavs: MkLocalFav[] = []
  for (const id of favIds) {
    const q = quotes.find(r => r.vendorId === id && r.comment && r.comment.trim().length > 8)
    if (!q) continue
    localFavs.push({ vendorId: id, quote: q.comment!.trim(), author: q.user.name.split(' ')[0], authorTown: cityName(q.user.city), local: q.user.city === city, checkIns: checkIns.get(id) ?? 0 })
  }

  // Open late tonight, latest closing first.
  const openLate: MkLate[] = rows
    .map(v => ({ v, r: lateRange(v.hours, now) }))
    .filter((x): x is { v: (typeof rows)[number]; r: { opensAt: Date; closesAt: Date } } => Boolean(x.r))
    // Open now, or opening in the next few hours (not tomorrow lunchtime at 1am).
    .filter(x => x.r.opensAt.getTime() <= now.getTime() + LATE_SOON_MS)
    .sort((a, b) => Number(b.r.opensAt <= now) - Number(a.r.opensAt <= now) || b.r.closesAt.getTime() - a.r.closesAt.getTime())
    .map(({ v, r }) => ({ vendorId: v.id, opensAt: r.opensAt.toISOString(), closesAt: r.closesAt.toISOString(), openNow: r.opensAt.getTime() <= now.getTime() }))

  return {
    town: { city, name: town.name, lat: town.lat, lng: town.lng },
    vendors: vendors.sort(rank),
    bon,
    dishes,
    deals: [...liveBoosts, ...perks],
    localFavs,
    jerk: tagged(SECTION_TAGS.jerk),
    bars: tagged(SECTION_TAGS.bars),
    openLate,
    crafts: tagged(SECTION_TAGS.crafts),
    stays: [
      ...stays.filter(s => s.partner?.active),
      ...stays.filter(s => !s.partner?.active)
    ].map(s => ({
      id: s.id, name: s.name, type: s.type,
      images: (Array.isArray(s.media) ? (s.media as Array<{ type?: string; url?: string }>) : []).filter(m => m?.url && m.type !== 'video').map(m => m.url as string).slice(0, 5),
      nightlyPrice: s.nightlyPrice, priceRange: s.priceRange, amenities: s.amenities,
      partner: s.partner?.active ? { code: s.partner.code, name: s.partner.name } : null
    })),
    essentials: tagged(SECTION_TAGS.essentials)
  }
}
