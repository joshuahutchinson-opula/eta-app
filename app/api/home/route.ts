// GET /api/home?city=[&port=&backBy=] — Home's "today in <town>"
// (lib/home.ts): the daypart from the real sun, the hero (town media for
// the daypart, or tonight's big event), Featured, Choose The Vibe in
// daypart order, and whether the Vibe feed has enough video to show.
// Cruise day: port (OCHO_RIOS | FALMOUTH | MONTEGO_BAY) and backBy (the
// all-aboard time, ISO) keep Featured to places you can get back from.
import { NextResponse } from 'next/server'
import { homeToday } from '@/lib/home'
import { parseCity } from '@/lib/regions'
import { cruisePortFor } from '@/lib/places-geo'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const port = cruisePortFor(q.get('port'))
  const backBy = q.get('backBy') ? new Date(q.get('backBy')!) : null
  const cruise = port && backBy && !isNaN(backBy.getTime()) ? { port, backBy } : null
  try {
    return NextResponse.json(await homeToday(parseCity(q.get('city')), new Date(), cruise))
  } catch (error) {
    console.error('Home failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
