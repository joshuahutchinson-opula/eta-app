// POST { rewardId } (signed in) — spend points on a reward (lib/vouchers.ts):
// tier, audience, visit lock and the reward's daily/monthly caps are
// checked, the points come off through the ledger in the same transaction
// that issues the single-use voucher.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { redeemReward, VoucherError } from '@/lib/vouchers'
import { rateLimit } from '@/lib/rate-limit'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to redeem rewards' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('redeem', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, z.object({ rewardId: id }))
  if (!parsed.ok) return parsed.response
  try {
    return NextResponse.json(await redeemReward(auth.user.id, parsed.data.rewardId), { status: 201 })
  } catch (error) {
    if (error instanceof VoucherError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
    console.error('Error redeeming reward:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
