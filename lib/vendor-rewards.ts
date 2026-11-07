// lib/vendor-rewards.ts — what a vendor can set on a reward in the vendor
// app (app/api/vendor-app/vendors/:id/rewards and /api/vendor-app/rewards/:id).
import { z } from '@/lib/validate'
import { prisma } from '@/lib/prisma'
import { canActForVendor, type AuthedUser } from '@/lib/auth-server'

export const rewardFields = {
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().min(3).max(300),
  cost: z.number().int().min(50).max(100000),
  icon: z.string().trim().max(24).default('gift'),
  validDays: z.number().int().min(1).max(365).default(30),
  dailyCap: z.number().int().min(1).max(1000),
  monthlyBudget: z.number().int().min(1).max(10000),
  minTier: z.enum(['EXPLORER', 'INSIDER', 'YAADIE']).nullable().default(null),
  category: z.enum(['vendor', 'insider', 'events']).default('vendor'),
  audience: z.enum(['all', 'local']).default('all'),
  requiresVisit: z.boolean().default(false),
  eventId: z.string().max(64).nullable().default(null),
  active: z.boolean().default(true)
}

/** The vendor (one the caller can act for) that may edit this reward: the one that created it. */
export async function vendorForReward(user: AuthedUser, rewardId: string): Promise<string | null> {
  const reward = await prisma.reward.findUnique({ where: { id: rewardId }, select: { createdByVendorId: true, vendors: { select: { vendorId: true } } } })
  if (!reward) return null
  const candidates = reward.createdByVendorId ? [reward.createdByVendorId] : reward.vendors.map(v => v.vendorId)
  for (const v of candidates) if (await canActForVendor(user, v)) return v
  return null
}
