// GET ?lat=&lng= — hospitals and clinics (nearest first when a position is
// sent), tourist police and embassies for the Safety screen.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { haversineKm } from '@/lib/routing'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const lat = Number(q.get('lat'))
  const lng = Number(q.get('lng'))
  const here = Number.isFinite(lat) && Number.isFinite(lng) && q.get('lat') && q.get('lng') ? { lat, lng } : null
  try {
    const rows = await prisma.safetyContact.findMany({ orderBy: { sortOrder: 'asc' } })
    const withKm = rows.map(r => ({ ...r, km: here && r.lat !== null && r.lng !== null ? Math.round(haversineKm(here, { lat: r.lat, lng: r.lng }) * 10) / 10 : null }))
    const byDistance = <T extends { km: number | null }>(xs: T[]) => (here ? [...xs].sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity)) : xs)
    return NextResponse.json({
      medical: byDistance(withKm.filter(r => r.kind === 'HOSPITAL' || r.kind === 'CLINIC')),
      police: byDistance(withKm.filter(r => r.kind === 'TOURIST_POLICE')),
      embassies: withKm.filter(r => r.kind === 'EMBASSY')
    })
  } catch (error) {
    console.error('Error fetching safety contacts:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
