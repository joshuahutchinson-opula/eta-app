// POST /api/visits/pending { code, lat?, lng? } — no sign-in. A vendor's QR
// was scanned with the phone camera by someone without ETA: hold the visit
// (lib/pending-visits.ts) and send them to the vendor's web page with "Get
// ETA to collect your points". Credited if they sign up within 24 hours.
import { NextResponse } from 'next/server'
import { holdVisit } from '@/lib/pending-visits'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  code: z.string().trim().min(4).max(300),
  lat: z.number().finite().min(-90).max(90).nullable().optional(),
  lng: z.number().finite().min(-180).max(180).nullable().optional()
})

export async function POST(request: Request) {
  const limited = rateLimit('visit', clientIp(request))
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { code, lat, lng } = parsed.data
  try {
    const held = await holdVisit(code, typeof lat === 'number' && typeof lng === 'number' ? { lat, lng } : null)
    if (!held) return NextResponse.json({ error: 'That isn’t an ETA vendor code', code: 'QR_INVALID' }, { status: 404 })
    return NextResponse.json(held, { status: 201 })
  } catch (error) {
    console.error('Holding visit failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
