// GET /api/partners/:code/stay — "At your stay" for guests of a partner
// property (they entered its code or picked it as their stay): its linked
// vendors, specials, events and Host's picks (lib/at-stay.ts).
import { NextResponse } from 'next/server'
import { atStay } from '@/lib/at-stay'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { code: string } }) {
  try {
    const data = await atStay(params.code)
    return data ? NextResponse.json(data) : NextResponse.json({ error: 'Nuttin nuh go suh', code: 'PARTNER_NOT_FOUND' }, { status: 404 })
  } catch (error) {
    console.error('At-stay failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
