// app/search/route.ts — one query across vendors (and their menus),
// experiences, events, photo spots and stays, grouped.
// GET ?q=jerk&city=NEGRIL (city optional; matches in the chosen region come
// first). Nothing found → close spellings (lib/search.ts), flagged fuzzy.
// Every search is logged (query + result count, no user) for Popular searches.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isCityCode } from '@/lib/regions'
import { similarIds } from '@/lib/search'

export const dynamic = 'force-dynamic'

const VENDOR_SELECT = { id: true, name: true, category: true, neighborhood: true, city: true, images: true, isPremium: true, isTransport: true } as const

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim().slice(0, 60)
  const city = params.get('city')
  const empty = { vendors: [], experiences: [], events: [], photoSpots: [], stays: [], fuzzy: false }
  if (q.length < 2) return NextResponse.json(empty)
  const contains = { contains: q, mode: 'insensitive' as const }
  const regionFirst = <T extends { city: string }>(rows: T[]) => isCityCode(city) ? [...rows.filter(r => r.city === city), ...rows.filter(r => r.city !== city)] : rows
  const upcoming: Prisma.EventWhereInput = { OR: [{ endAt: { gte: new Date() } }, { endAt: null, startAt: { gte: new Date(Date.now() - 6 * 3600000) } }] }

  const run = async (match: {
    vendor: Prisma.VendorWhereInput; menu: Prisma.MenuItemWhereInput; experience: Prisma.ExperienceWhereInput
    event: Prisma.EventWhereInput; photoSpot: Prisma.PhotoSpotWhereInput; stay: Prisma.AccommodationWhereInput
  }) => {
    const [vendors, menuHits, experiences, events, photoSpots, stays] = await Promise.all([
      prisma.vendor.findMany({ where: { visibleInMarketplace: true, ...match.vendor }, select: VENDOR_SELECT, take: 20 }),
      prisma.menuItem.findMany({ where: { available: true, vendor: { visibleInMarketplace: true }, ...match.menu }, select: { name: true, vendor: { select: VENDOR_SELECT } }, take: 30 }),
      prisma.experience.findMany({ where: match.experience, select: { id: true, name: true, tagline: true, imageUrl: true, price: true, city: true }, take: 10 }),
      prisma.event.findMany({ where: { AND: [upcoming, match.event] }, select: { id: true, title: true, venueName: true, startAt: true, imageUrl: true, city: true }, orderBy: { startAt: 'asc' }, take: 10 }),
      prisma.photoSpot.findMany({ where: match.photoSpot, select: { id: true, name: true, bestTime: true, officialPhoto: true, city: true }, take: 10 }),
      prisma.accommodation.findMany({ where: match.stay, select: { id: true, name: true, type: true, priceRange: true, city: true, media: true, nightlyPrice: true }, take: 10 })
    ])
    // A vendor whose menu matches shows up once, with the dish that matched.
    const byId = new Map(vendors.map(v => [v.id, { ...v, menuMatch: null as string | null }]))
    for (const hit of menuHits) if (!byId.has(hit.vendor.id)) byId.set(hit.vendor.id, { ...hit.vendor, menuMatch: hit.name })
    return { vendors: Array.from(byId.values()), experiences, events, photoSpots, stays: stays.map(s => ({ ...s, image: Array.isArray(s.media) ? ((s.media as Array<{ url?: string }>)[0]?.url ?? null) : null, media: undefined })) }
  }

  try {
    let result = await run({
      vendor: { OR: [{ name: contains }, { description: contains }, { neighborhood: contains }] },
      menu: { OR: [{ name: contains }, { description: contains }] },
      experience: { OR: [{ name: contains }, { tagline: contains }, { startLocation: contains }] },
      event: { OR: [{ title: contains }, { description: contains }, { venueName: contains }, { promoterName: contains }] },
      photoSpot: { OR: [{ name: contains }, { description: contains }] },
      stay: { OR: [{ name: contains }, { description: contains }] }
    })
    let total = result.vendors.length + result.experiences.length + result.events.length + result.photoSpots.length + result.stays.length
    let fuzzy = false
    if (total === 0 && q.length >= 3) {
      const [v, m, e, ev, p, s] = await Promise.all(['Vendor', 'MenuItem', 'Experience', 'Event', 'PhotoSpot', 'Accommodation'].map(tbl => similarIds(tbl as 'Vendor', q)))
      result = await run({
        vendor: { id: { in: v } }, menu: { id: { in: m } }, experience: { id: { in: e } },
        event: { id: { in: ev } }, photoSpot: { id: { in: p } }, stay: { id: { in: s } }
      })
      total = result.vendors.length + result.experiences.length + result.events.length + result.photoSpots.length + result.stays.length
      fuzzy = total > 0
    }
    if (q.length >= 3) {
      prisma.searchLog.create({ data: { query: q.toLowerCase(), city: isCityCode(city) ? city : null, results: total } }).catch(() => {})
    }
    return NextResponse.json({
      vendors: regionFirst(result.vendors),
      experiences: regionFirst(result.experiences),
      events: regionFirst(result.events),
      photoSpots: regionFirst(result.photoSpots),
      stays: regionFirst(result.stays),
      fuzzy
    })
  } catch (error) {
    console.error('Search failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
