// GET /api/stays?q=&city=NEGRIL,LUCEA&limit= — "Where are you staying?":
// stays and partner properties matching a name, partners first.
import { NextResponse } from 'next/server'
import { searchStays } from '@/lib/stays'
import { isCityCode } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const cities = (q.get('city') ?? '').split(',').map(s => s.trim()).filter(isCityCode)
  const limit = Math.min(50, Math.max(1, Number(q.get('limit')) || 30))
  try {
    return NextResponse.json(await searchStays({ q: q.get('q')?.slice(0, 80), cities, limit }))
  } catch (error) {
    console.error('Stay search failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
