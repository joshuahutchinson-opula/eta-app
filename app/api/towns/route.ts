// GET /api/towns — every town with a small photo for the town picker
// (components/TownPicker): its hero media (TownMedia: a photo, or a video's
// poster), else its best vendor photo, else none. Browsers cache it an hour.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { TOWNS, parishFor } from '@/lib/regions'

export const dynamic = 'force-dynamic'
const CACHE = { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' }

export async function GET() {
  try {
    const [media, vendors] = await Promise.all([
      prisma.townMedia.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { city: true, kind: true, url: true, poster: true } }),
      prisma.vendor.findMany({ where: { visibleInMarketplace: true, isTransport: false, images: { isEmpty: false } }, orderBy: [{ isPremium: 'desc' }, { whoThere: 'desc' }], select: { city: true, images: true } })
    ])
    const photo = (city: string) => {
      const m = media.find(x => x.city === city)
      if (m) return m.kind === 'video' ? m.poster : m.url
      return vendors.find(v => v.city === city)?.images[0] ?? null
    }
    return NextResponse.json(TOWNS.map(t => ({ city: t.city, name: t.name, parish: parishFor(t.city).name, image: photo(t.city) })), { headers: CACHE })
  } catch (error) {
    console.error('Towns failed:', error)
    return NextResponse.json(TOWNS.map(t => ({ city: t.city, name: t.name, parish: parishFor(t.city).name, image: null })))
  }
}
