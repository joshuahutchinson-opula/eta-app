// lib/welcome.ts — welcome rewards: free, once-per-traveler vouchers handed
// out by the arrival moment (first open at the airport or a hotel) and by
// partner property codes. They're ordinary Reward rows with kind "welcome",
// so which perks exist, where, and at which vendors is data, set up later
// (no code change). Claiming issues a Redemption with pointCost 0.
import crypto from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const WELCOME_KIND = 'welcome'
/** Returning travelers: a gift each trip they come back (lib/travel-trips.ts). */
export const WELCOME_BACK_KIND = 'welcome_back'

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
export async function welcomeRewardFor(city: string, rewardId?: string | null, kind: string = WELCOME_KIND): Promise<WelcomeReward | null> {
  if (rewardId) {
    const r = await prisma.reward.findFirst({ where: { id: rewardId, active: true, kind }, include: INCLUDE })
    if (r) return shape(r)
  }
  const rows = await prisma.reward.findMany({
    where: { active: true, kind, OR: [{ city: city as never }, { city: null }] },
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

/** The welcome-back gift for a returning traveler's trip: a specific one, or the town's, or island-wide. */
export function welcomeBackRewardFor(city: string, rewardId?: string | null) {
  return welcomeRewardFor(city, rewardId, WELCOME_BACK_KIND)
}

/** One welcome-back voucher per trip: claiming again on the same trip returns the same one. */
export async function claimWelcomeBack(userId: string, tripId: string, rewardId?: string | null) {
  const trip = await prisma.travelTrip.findFirst({ where: { id: tripId, OR: [{ ownerId: userId }, { members: { some: { userId } } }] }, select: { id: true, city: true, ownerId: true, welcomeBackRedemptionId: true } })
  if (!trip) throw new WelcomeError('Nuttin nuh go suh')
  if (trip.welcomeBackRedemptionId && trip.ownerId === userId) {
    const existing = await prisma.redemption.findUnique({ where: { id: trip.welcomeBackRedemptionId } })
    if (existing) return { redemption: existing, alreadyClaimed: true }
  }
  const reward = await welcomeBackRewardFor(trip.city, rewardId)
  if (!reward) throw new WelcomeError('No welcome-back gift on right now')
  const full = await prisma.reward.findUnique({ where: { id: reward.id } })
  const redemption = await prisma.redemption.create({
    data: {
      userId,
      rewardId: reward.id,
      rewardName: reward.name,
      pointCost: 0,
      code: `ETA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      expiresAt: new Date(Date.now() + (full?.validDays ?? 7) * 86400000)
    }
  })
  if (trip.ownerId === userId) await prisma.travelTrip.update({ where: { id: trip.id }, data: { welcomeBackRedemptionId: redemption.id } })
  return { redemption, alreadyClaimed: false }
}
