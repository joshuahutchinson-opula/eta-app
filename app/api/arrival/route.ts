// GET /api/arrival?lat=&lng= — is this first open an arrival? Returns the
// airport or stay the device is at (null when neither), the town to switch
// to, vetted transfers (from airports) and the welcome reward on offer
// there. Claiming the reward is POST /api/welcome.
import { NextResponse } from 'next/server'
import { arrivalPlace, transfersFor } from '@/lib/arrival'
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
    const [transfers, reward] = await Promise.all([
      place.kind === 'airport' ? transfersFor(place.city) : Promise.resolve([]),
      welcomeRewardFor(place.city, place.welcomeRewardId)
    ])
    return NextResponse.json({ place, city: place.city, transfers, reward })
  } catch (error) {
    console.error('Arrival check failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
