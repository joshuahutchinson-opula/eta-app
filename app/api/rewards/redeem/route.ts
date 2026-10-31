// POST { rewardId } (signed in) — spend points on a reward. Points come off
// server-side in the same transaction that issues the voucher code, so the
// balance can't go negative and the voucher always exists if the points left.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { REWARD_TIERS, getTierForPoints } from '@/lib/rewardTiers'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

class RedeemError extends Error {}

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to redeem rewards' })
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  const parsed = await parseBody(request, z.object({ rewardId: id }))
  if (!parsed.ok) return parsed.response
  const reward = await prisma.reward.findFirst({ where: { id: parsed.data.rewardId, active: true } })
  if (!reward) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })

  try {
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { points: true } })
      if (!user) throw new RedeemError('Log in to redeem rewards')
      if (reward.minTier) {
        const need = REWARD_TIERS.findIndex(t => t.key === reward.minTier)
        const have = REWARD_TIERS.findIndex(t => t.key === getTierForPoints(user.points).key)
        if (have < need) throw new RedeemError(`${REWARD_TIERS[need].label} tier required`)
      }
      const debited = await tx.user.updateMany({ where: { id: userId, points: { gte: reward.cost } }, data: { points: { decrement: reward.cost } } })
      if (debited.count === 0) throw new RedeemError('Yuh nave nuff points fi dat yet')
      const redemption = await tx.redemption.create({
        data: {
          userId,
          rewardId: reward.id,
          rewardName: reward.name,
          pointCost: reward.cost,
          code: `ETA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          expiresAt: new Date(Date.now() + reward.validDays * 86400000)
        }
      })
      const after = await tx.user.findUnique({ where: { id: userId }, select: { points: true } })
      return { redemption, points: after?.points ?? 0 }
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof RedeemError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Error redeeming reward:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
