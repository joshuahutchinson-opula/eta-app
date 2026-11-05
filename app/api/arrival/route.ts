// GET /api/arrival?lat=&lng= — is this first open an arrival? Returns the
// airport or stay the device is at (null when neither), the town to switch
// to and the welcome gift on offer there. The arrival flow (app/arrival)
// takes it from here: stay search, transfers (/api/transfers), check-in.
import { NextResponse } from 'next/server'
import { arrivalPlace } from '@/lib/arrival'
import { welcomeRewardFor } from '@/lib/welcome'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const lat = Number(q.get('lat'))
  const lng = Number(q.get('lng'))
  if (!q.get('lat') || !q.get('lng') || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
  }
  try {
    const place = await arrivalPlace({ lat, lng })
    if (!place) return NextResponse.json({ place: null })
    const reward = await welcomeRewardFor(place.city, place.welcomeRewardId)
    return NextResponse.json({ place, city: place.city, reward })
  } catch (error) {
    console.error('Arrival check failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
