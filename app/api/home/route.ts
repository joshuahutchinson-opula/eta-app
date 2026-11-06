// GET /api/home?city= — Home's "today in <town>" (lib/home.ts): the daypart
// from the real sun, Featured, today's story, Choose The Vibe in daypart
// order, and whether the Vibe feed has enough video to show.
import { NextResponse } from 'next/server'
import { homeToday } from '@/lib/home'
import { parseCity } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    return NextResponse.json(await homeToday(parseCity(new URL(request.url).searchParams.get('city'))))
  } catch (error) {
    console.error('Home failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
