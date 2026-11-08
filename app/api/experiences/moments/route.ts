// GET ?city=NEGRIL&mood=&time=&crew= — the Experiences tab's moments for
// the town right now (lib/moments.ts): the big card, Up Next and Parties &
// Happenings. mood/time/crew are the traveler's Plan My Day answers.
import { NextResponse } from 'next/server'
import { parseCity } from '@/lib/regions'
import { momentsFor } from '@/lib/moments'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const city = parseCity(q.get('city'))
  const crew = Number(q.get('crew'))
  try {
    const data = await momentsFor(city, {
      mood: q.get('mood')?.slice(0, 60) || null,
      time: q.get('time')?.slice(0, 10) || null,
      crew: Number.isFinite(crew) && crew > 0 ? Math.floor(crew) : null
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error building moments:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
