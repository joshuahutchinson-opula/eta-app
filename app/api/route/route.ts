// GET /api/route?points=lng,lat;lng,lat;…&mode=driving|walking — the road
// geometry through those stops (lib/routing.ts roadGeometry), for drawing
// routes on maps along real streets. Up to 25 points.
import { NextResponse } from 'next/server'
import { roadGeometry, type LatLng } from '@/lib/routing'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const limited = rateLimit('route', clientIp(request))
  if (limited) return limited
  const q = new URL(request.url).searchParams
  const points: LatLng[] = (q.get('points') ?? '').split(';').slice(0, 25).map(pair => {
    const [lng, lat] = pair.split(',').map(Number)
    return { lat, lng }
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)
  if (points.length < 2) return NextResponse.json({ error: 'Give at least two points as lng,lat;lng,lat' }, { status: 400 })
  const mode = q.get('mode') === 'walking' ? 'walking' : 'driving'
  const result = await roadGeometry(points, mode)
  return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
