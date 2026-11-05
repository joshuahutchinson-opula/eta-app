// /api/welcome — welcome rewards (lib/welcome.ts).
// GET ?city=        → the welcome reward on offer in that town, or null.
// POST { rewardId } → claim it (signed in): a free voucher, once per traveler.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { claimWelcome, welcomeRewardFor, WelcomeError } from '@/lib/welcome'
import { parseCity } from '@/lib/regions'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    return NextResponse.json({ reward: await welcomeRewardFor(parseCity(new URL(request.url).searchParams.get('city'))) })
  } catch (error) {
    console.error('Error loading welcome reward:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to claim your welcome perk' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ rewardId: id }))
  if (!parsed.ok) return parsed.response
  try {
    const result = await claimWelcome(auth.user.id, parsed.data.rewardId)
    return NextResponse.json(result, { status: result.alreadyClaimed ? 200 : 201 })
  } catch (error) {
    if (error instanceof WelcomeError) return NextResponse.json({ error: error.message }, { status: 404 })
    console.error('Error claiming welcome reward:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
