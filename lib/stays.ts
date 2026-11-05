// lib/stays.ts — stays are listings, not bookings: guests book directly with
// the property and ETA takes nothing from the room. Partner properties
// (ETA Partner badge) always come first, in search and in listings.
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface StayResult {
  /** The stay listing's id, or null for a partner without a listing. */
  accommodationId: string | null
  name: string
  type: string | null
  city: string
  lat: number | null
  lng: number | null
  image: string | null
  partner: { code: string; name: string } | null
}

function firstImage(media: Prisma.JsonValue, fallback: string | null = null): string | null {
  const list = Array.isArray(media) ? media : []
  const hit = list.find(m => m && typeof m === 'object' && 'url' in m && typeof (m as { url?: unknown }).url === 'string') as { url: string } | undefined
  return hit?.url ?? fallback
}

/** Partners first, then the rest; name matches anywhere, case-insensitive. */
export async function searchStays({ q, cities, limit = 30 }: { q?: string | null; cities?: string[] | null; limit?: number }): Promise<StayResult[]> {
  const name = q?.trim() ? { contains: q.trim(), mode: 'insensitive' as const } : undefined
  const city = cities?.length ? { in: cities as never[] } : undefined
  const [partners, stays] = await Promise.all([
    prisma.partnerProperty.findMany({
      where: { active: true, ...(name ? { name } : {}), ...(city ? { city } : {}) },
      include: { accommodation: { select: { id: true, type: true, media: true, lat: true, lng: true } } },
      orderBy: { name: 'asc' },
      take: limit
    }),
    prisma.accommodation.findMany({
      where: { partner: null, ...(name ? { name } : {}), ...(city ? { city } : {}) },
      orderBy: [{ vetted: 'desc' }, { googleStars: 'desc' }],
      select: { id: true, name: true, type: true, city: true, lat: true, lng: true, media: true },
      take: limit
    })
  ])
  return [
    ...partners.map(p => ({
      accommodationId: p.accommodation?.id ?? null,
      name: p.name,
      type: p.accommodation?.type ?? (p.kind === 'VILLA' ? 'VILLA' : null),
      city: p.city,
      lat: p.lat ?? p.accommodation?.lat ?? null,
      lng: p.lng ?? p.accommodation?.lng ?? null,
      image: p.imageUrl ?? firstImage(p.accommodation?.media ?? null),
      partner: { code: p.code, name: p.name }
    })),
    ...stays.map(s => ({ accommodationId: s.id, name: s.name, type: s.type, city: s.city, lat: s.lat, lng: s.lng, image: firstImage(s.media), partner: null }))
  ].slice(0, limit)
}

export { firstImage }
