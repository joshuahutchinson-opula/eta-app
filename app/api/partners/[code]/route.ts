// /api/partners/:code — hotel and villa partner codes (lib/partners.ts).
// GET  → the property and its welcome perk, for the code screen (public).
// POST → join through it (signed in): records the referral (first one wins),
//        sets where they're staying, and claims the perk.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { joinPartner, partnerPreview } from '@/lib/partners'
import { clientIp, rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const NOT_FOUND = { error: 'We don’t know that code — check it with the front desk', code: 'PARTNER_NOT_FOUND' }

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const limited = rateLimit('partnerCode', clientIp(request))
  if (limited) return limited
  try {
    const preview = await partnerPreview(params.code)
    return preview ? NextResponse.json(preview) : NextResponse.json(NOT_FOUND, { status: 404 })
  } catch (error) {
    console.error('Error loading partner:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const auth = await requireUser(request, { message: 'Log in to claim your welcome perk' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('partnerCode', auth.user.id)
  if (limited) return limited
  try {
    const joined = await joinPartner(auth.user.id, params.code)
    return joined ? NextResponse.json(joined) : NextResponse.json(NOT_FOUND, { status: 404 })
  } catch (error) {
    console.error('Error joining partner:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
