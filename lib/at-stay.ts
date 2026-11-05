// lib/at-stay.ts — "At your stay": what a partner property offers its own
// guests (its linked vendors, their specials and deals, the property's
// events, and Host's picks), plus what it covers, so recommendations can
// lean toward what it doesn't (lib/host-lean.ts).
import { prisma } from '@/lib/prisma'
import { findPartner } from '@/lib/partners'
import { hostPicksFor, type HostPickView } from '@/lib/host-picks'
import { firstImage } from '@/lib/stays'

export interface AtStay {
  property: { id: string; code: string; name: string; city: string; lat: number | null; lng: number | null; image: string | null; accommodationId: string | null }
  vendors: Array<{ id: string; name: string; category: string; neighborhood: string; priceRange: string; description: string; images: string[]; videos: string[]; open: boolean; live: boolean; isPremium: boolean; whoThere: number; fairPrice: boolean }>
  specials: Array<{ kind: 'dish' | 'deal'; vendorId: string; vendorName: string; title: string; price: number | null; image: string | null; expires: string | null }>
  events: Array<{ id: string; title: string; startAt: string; endAt: string | null; venueName: string; imageUrl: string | null; isFree: boolean; price: number | null }>
  picks: HostPickView[]
  /** Vendor categories the property covers itself. */
  covers: string[]
}

export async function atStay(code: string): Promise<AtStay | null> {
  const p = await findPartner(code)
  if (!p) return null
  const now = new Date()
  const [accommodation, vendors, events, picks] = await Promise.all([
    p.accommodationId ? prisma.accommodation.findUnique({ where: { id: p.accommodationId }, select: { media: true } }) : null,
    prisma.vendor.findMany({
      where: { partnerPropertyId: p.id },
      select: { id: true, name: true, category: true, neighborhood: true, priceRange: true, description: true, images: true, videos: true, open: true, live: true, isPremium: true, whoThere: true, fairPrice: true, dishOfDay: true, flashDeals: { where: { expires: { gt: now } }, select: { id: true, deal: true, expires: true } } },
      orderBy: { name: 'asc' }
    }),
    prisma.event.findMany({
      where: { partnerPropertyId: p.id, startAt: { lte: new Date(now.getTime() + 7 * 86400000) }, OR: [{ endAt: { gte: now } }, { endAt: null, startAt: { gte: new Date(now.getTime() - 6 * 3600000) } }] },
      orderBy: { startAt: 'asc' },
      take: 10,
      select: { id: true, title: true, startAt: true, endAt: true, venueName: true, imageUrl: true, isFree: true, price: true }
    }),
    hostPicksFor(p.id)
  ])

  const specials: AtStay['specials'] = []
  for (const v of vendors) {
    const dish = v.dishOfDay as { name?: string; price?: number | null; imageUrl?: string | null } | null
    if (dish?.name) specials.push({ kind: 'dish', vendorId: v.id, vendorName: v.name, title: dish.name, price: dish.price ?? null, image: dish.imageUrl ?? v.images[0] ?? null, expires: null })
    for (const d of v.flashDeals) specials.push({ kind: 'deal', vendorId: v.id, vendorName: v.name, title: d.deal, price: null, image: v.images[0] ?? null, expires: d.expires.toISOString() })
  }

  return {
    property: { id: p.id, code: p.code, name: p.name, city: p.city, lat: p.lat, lng: p.lng, image: p.imageUrl ?? (accommodation ? firstImage(accommodation.media) : null), accommodationId: p.accommodationId },
    vendors: vendors.map(({ dishOfDay: _d, flashDeals: _f, ...v }) => v),
    specials,
    events: events.map(e => ({ ...e, startAt: e.startAt.toISOString(), endAt: e.endAt?.toISOString() ?? null })),
    picks,
    covers: Array.from(new Set(vendors.map(v => v.category)))
  }
}
