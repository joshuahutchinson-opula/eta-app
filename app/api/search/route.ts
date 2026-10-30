// app/api/search/route.ts — one query across vendors, experiences, events
// and photo spots, grouped. GET ?q=jerk&city=NEGRIL (city optional; matches in
// the chosen region come first).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCityCode } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').trim().slice(0, 60)
  const city = params.get('city')
  if (q.length < 2) return NextResponse.json({ vendors: [], experiences: [], events: [], photoSpots: [] })
  const contains = { contains: q, mode: 'insensitive' as const }
  const regionFirst = <T extends { city: string }>(rows: T[]) => isCityCode(city) ? [...rows.filter(r => r.city === city), ...rows.filter(r => r.city !== city)] : rows

  try {
    const [vendors, experiences, events, photoSpots] = await Promise.all([
      prisma.vendor.findMany({
        where: { visibleInMarketplace: true, OR: [{ name: contains }, { description: contains }, { neighborhood: contains }] },
        select: { id: true, name: true, category: true, neighborhood: true, city: true, images: true, isPremium: true, isTransport: true },
        take: 20
      }),
      prisma.experience.findMany({
        where: { OR: [{ name: contains }, { tagline: contains }, { startLocation: contains }] },
        select: { id: true, name: true, tagline: true, imageUrl: true, price: true, city: true },
        take: 10
      }),
      prisma.event.findMany({
        where: { OR: [{ endAt: { gte: new Date() } }, { endAt: null, startAt: { gte: new Date(Date.now() - 6 * 3600000) } }], AND: [{ OR: [{ title: contains }, { description: contains }, { venueName: contains }, { promoterName: contains }] }] },
        select: { id: true, title: true, venueName: true, startAt: true, imageUrl: true, city: true },
        orderBy: { startAt: 'asc' },
        take: 10
      }),
      prisma.photoSpot.findMany({
        where: { OR: [{ name: contains }, { description: contains }] },
        select: { id: true, name: true, bestTime: true, officialPhoto: true, city: true },
        take: 10
      })
    ])
    return NextResponse.json({
      vendors: regionFirst(vendors),
      experiences: regionFirst(experiences),
      events: regionFirst(events),
      photoSpots: regionFirst(photoSpots)
    })
  } catch (error) {
    console.error('Search failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
