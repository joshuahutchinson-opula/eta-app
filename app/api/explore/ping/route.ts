// POST /api/explore/ping { city, lat, lng, accuracy? } (signed in) — a
// position fix from Explore mode. Reveals secret spots within range (points +
// discovery), advances the active quest, and returns the distance band of the
// nearest unfound spot for the warmer/colder hint. The phone never learns
// where an unfound spot is.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { explorePing } from '@/lib/explore'
import { MAX_GPS_ACCURACY_M } from '@/lib/hidden-gems'
import { CITY_CODES, type CityCode } from '@/lib/regions'
import { rateLimit } from '@/lib/rate-limit'
import { lat, lng, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({ city: z.enum(CITY_CODES as [string, ...string[]]), lat, lng, accuracy: z.number().finite().min(0).optional() })

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to play Explore mode' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('explorePing', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { city, accuracy, ...pos } = parsed.data
  if (accuracy !== undefined && accuracy > MAX_GPS_ACCURACY_M) return NextResponse.json({ revealed: [], quests: [], band: null, fuzzy: true })
  try {
    return NextResponse.json(await explorePing(auth.user.id, city as CityCode, pos))
  } catch (error) {
    console.error('Explore ping failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
