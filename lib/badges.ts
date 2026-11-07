// lib/badges.ts — collectable badges on the Rewards hub. Progress is worked
// out from real check-ins, discoveries and donations; the moment a badge is
// unlocked is kept in UserBadge (so it stays earned, and the seed can hand
// out demo badges). The hub shows a "one more to unlock" nudge for any
// badge one step away, and each earned badge has a shareable card
// (components/rewards/BadgeShare.tsx).
import { prisma } from '@/lib/prisma'

export interface BadgeDef {
  key: string
  icon: string
  target: number
}

export const BADGES: BadgeDef[] = [
  { key: 'sunsetChaser', icon: 'sun', target: 5 },
  { key: 'jerkTrail', icon: 'flame', target: 5 },
  { key: 'cliffHopper', icon: 'wave', target: 3 },
  { key: 'secretSpots', icon: 'sparkle', target: 5 },
  { key: 'townHopper', icon: 'route', target: 3 },
  { key: 'giveBack', icon: 'heart', target: 1 }
]

export interface BadgeView { key: string; icon: string; target: number; progress: number; earned: boolean; earnedAt: string | null }

/** Jamaica hour (0–23.99) of a moment. */
const jamaicaHour = (d: Date) => { const j = new Date(d.getTime() - 5 * 3600000); return j.getUTCHours() + j.getUTCMinutes() / 60 }

/** Every badge with the user's progress. Records newly earned ones; returns them in `unlocked`. */
export async function badgesFor(userId: string): Promise<{ badges: BadgeView[]; unlocked: string[] }> {
  const [checkIns, gems, donations, stored] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId },
      select: { createdAt: true, vendorId: true, photoSpotId: true, vendor: { select: { name: true, description: true, city: true } }, photoSpot: { select: { name: true, city: true } } }
    }),
    prisma.discovery.count({ where: { userId, hiddenGemId: { not: null }, type: { in: ['HIDDEN_GEM', 'SECRET_SPOT'] } } }),
    prisma.donation.count({ where: { userId } }),
    prisma.userBadge.findMany({ where: { userId } })
  ])
  const distinct = (pred: (c: typeof checkIns[number]) => boolean) =>
    new Set(checkIns.filter(pred).map(c => c.vendorId ?? c.photoSpotId)).size
  const text = (c: typeof checkIns[number]) => `${c.vendor?.name ?? ''} ${c.vendor?.description ?? ''} ${c.photoSpot?.name ?? ''}`.toLowerCase()

  const progress: Record<string, number> = {
    // Golden hour check-ins, 5 pm to 7:30 pm Jamaica time.
    sunsetChaser: checkIns.filter(c => { const h = jamaicaHour(c.createdAt); return h >= 17 && h < 19.5 }).length,
    jerkTrail: distinct(c => Boolean(c.vendorId) && text(c).includes('jerk')),
    cliffHopper: distinct(c => text(c).includes('cliff')),
    secretSpots: gems,
    townHopper: new Set(checkIns.map(c => c.vendor?.city ?? c.photoSpot?.city).filter(Boolean)).size,
    giveBack: donations
  }
  const have = new Map(stored.map(s => [s.key, s.earnedAt]))
  const unlocked = BADGES.filter(b => !have.has(b.key) && progress[b.key] >= b.target).map(b => b.key)
  if (unlocked.length) {
    await prisma.userBadge.createMany({ data: unlocked.map(key => ({ userId, key })), skipDuplicates: true })
    const now = new Date()
    unlocked.forEach(k => have.set(k, now))
  }
  const badges = BADGES.map(b => {
    const at = have.get(b.key) ?? null
    return { key: b.key, icon: b.icon, target: b.target, progress: at ? b.target : Math.min(progress[b.key] ?? 0, b.target), earned: Boolean(at), earnedAt: at ? at.toISOString() : null }
  })
  return { badges, unlocked }
}
