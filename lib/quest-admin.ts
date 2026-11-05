// lib/quest-admin.ts — creating and editing quests from the vendor app
// (app/api/vendor-app/quests). ETA admins can make any quest; a vendor makes
// quests it sponsors (vendorId one of theirs), with checkpoints anywhere.
import { prisma } from '@/lib/prisma'
import type { AuthedUser } from '@/lib/auth-server'
import { CITY_CODES } from '@/lib/regions'
import { EXPLORER_KIND } from '@/lib/explore'
import { id, lat, lng, text, z } from '@/lib/validate'

/** Vendors can attach up to this many points to a quest they make. */
export const VENDOR_MAX_POINTS = 300

export const checkpointSchema = z.object({
  name: text(80).min(1),
  clue: text(300).min(5),
  lat,
  lng,
  radiusM: z.number().int().min(25).max(300).optional(),
  vendorId: id.nullable().optional()
})

export const questSchema = z.object({
  title: text(80).min(3),
  description: text(600),
  city: z.enum(CITY_CODES as [string, ...string[]]),
  badgeName: text(40).min(2),
  rewardPoints: z.number().int().min(0).max(1000).optional(),
  rewardId: z.string().max(64).nullable().optional(),
  vendorId: id.nullable().optional(),
  active: z.boolean().optional(),
  checkpoints: z.array(checkpointSchema).min(2).max(12)
})

export class QuestError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}

/** Throws QuestError when this user can't make (or edit) a quest like this. */
export async function checkQuest(user: AuthedUser, input: Partial<z.infer<typeof questSchema>>) {
  if (user.role !== 'ADMIN' && user.role !== 'VENDOR') throw new QuestError('Only vendors or ETA admins can make quests', 403)
  if (user.role === 'VENDOR') {
    if (!input.vendorId) throw new QuestError('vendorId: pick the vendor that sponsors this quest')
    const owns = await prisma.vendor.findFirst({ where: { id: input.vendorId, ownerId: user.id }, select: { id: true } })
    if (!owns) throw new QuestError('You can only sponsor quests for vendors you run', 403)
    if ((input.rewardPoints ?? 0) > VENDOR_MAX_POINTS) throw new QuestError(`rewardPoints: vendors can attach up to ${VENDOR_MAX_POINTS}`)
  }
  if (input.rewardId) {
    const reward = await prisma.reward.findFirst({ where: { id: input.rewardId, kind: EXPLORER_KIND }, include: { vendors: { select: { vendorId: true } } } })
    if (!reward) throw new QuestError('rewardId: must be an explorer perk')
    if (user.role === 'VENDOR' && !reward.vendors.some(v => v.vendorId === input.vendorId)) throw new QuestError('rewardId: must be one of your own explorer perks', 403)
  }
  const vendorIds = (input.checkpoints ?? []).map(c => c.vendorId).filter((v): v is string => Boolean(v))
  if (vendorIds.length && (await prisma.vendor.count({ where: { id: { in: vendorIds } } })) !== new Set(vendorIds).size) throw new QuestError('checkpoints: unknown vendorId')
}

export async function canEditQuest(user: AuthedUser, quest: { createdById: string | null; vendorId: string | null }) {
  if (user.role === 'ADMIN') return true
  if (user.role !== 'VENDOR') return false
  if (quest.createdById === user.id) return true
  return Boolean(quest.vendorId && (await prisma.vendor.findFirst({ where: { id: quest.vendorId, ownerId: user.id }, select: { id: true } })))
}

export function slugify(title: string): string {
  return `${title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'quest'}-${Math.random().toString(36).slice(2, 6)}`
}
