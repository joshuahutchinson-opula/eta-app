// lib/welcome.ts — welcome rewards: free, once-per-traveler vouchers handed
// out by the arrival moment (first open at the airport or a hotel) and by
// partner property codes. They're ordinary Reward rows with kind "welcome",
// so which perks exist, where, and at which vendors is data, set up later
// (no code change). Claiming issues a Redemption with pointCost 0.
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const WELCOME_KIND = 'welcome'

const INCLUDE = { vendors: { include: { vendor: { select: { id: true, name: true, neighborhood: true, lat: true, lng: true } } } } } satisfies Prisma.RewardInclude

export interface WelcomeReward {
  id: string
  name: string
  description: string
  icon: string
  validDays: number
  vendors: Array<{ id: string; name: string; neighborhood: string; lat: number; lng: number }>
}

function shape(r: Prisma.RewardGetPayload<{ include: typeof INCLUDE }>): WelcomeReward {
  return { id: r.id, name: r.name, description: r.description, icon: r.icon, validDays: r.validDays, vendors: r.vendors.map(v => v.vendor) }
}

/** The welcome reward for a town: a specific one if asked for, else the town's own, else an island-wide one. */
export async function welcomeRewardFor(city: string, rewardId?: string | null): Promise<WelcomeReward | null> {
  if (rewardId) {
    const r = await prisma.reward.findFirst({ where: { id: rewardId, active: true, kind: WELCOME_KIND }, include: INCLUDE })
    if (r) return shape(r)
  }
  const rows = await prisma.reward.findMany({
    where: { active: true, kind: WELCOME_KIND, OR: [{ city: city as never }, { city: null }] },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: INCLUDE
  })
  const best = rows.find(r => r.city === city) ?? rows[0]
  return best ? shape(best) : null
}

export class WelcomeError extends Error {}

/** Issues the voucher once per traveler per reward; claiming again returns the same one. */
export async function claimWelcome(userId: string, rewardId: string) {
  const reward = await prisma.reward.findFirst({ where: { id: rewardId, active: true, kind: WELCOME_KIND } })
  if (!reward) throw new WelcomeError('That welcome perk isn’t available')
  const existing = await prisma.redemption.findFirst({ where: { userId, rewardId } })
  if (existing) return { redemption: existing, alreadyClaimed: true }
  const redemption = await prisma.redemption.create({
    data: {
      userId,
      rewardId: reward.id,
      rewardName: reward.name,
      pointCost: 0,
      code: `ETA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      expiresAt: new Date(Date.now() + reward.validDays * 86400000)
    }
  })
  return { redemption, alreadyClaimed: false }
}
