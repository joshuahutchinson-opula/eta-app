// lib/challenges.ts — monthly challenges ("Visit 3 new beaches this month").
// A Challenge row names a metric below and a target; progress is counted
// from the user's discoveries and check-ins in that Jamaica-time month, and
// the bonus is paid once, the first time progress reaches the target
// (checked after every check-in and whenever Rewards loads).
import { prisma } from '@/lib/prisma'

export const CHALLENGE_METRICS = ['NEW_BEACHES', 'NEW_FOOD_SPOTS', 'NEW_PLACES', 'CHECKINS', 'PHOTO_SPOTS', 'HIDDEN_GEMS'] as const
export type ChallengeMetric = (typeof CHALLENGE_METRICS)[number]

const OFFSET = 5 * 3600000 // Jamaica is UTC-5 year-round

/** "2026-10" for the Jamaica-time month containing `date`. */
export function monthKey(date = new Date()): string {
  const local = new Date(date.getTime() - OFFSET)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`
}

export function monthBounds(key: string): { start: Date; end: Date } {
  const [y, m] = key.split('-').map(Number)
  return { start: new Date(Date.UTC(y, m - 1, 1) + OFFSET), end: new Date(Date.UTC(y, m, 1) + OFFSET) }
}

export async function progressFor(userId: string, metric: string, month: string): Promise<number> {
  const { start, end } = monthBounds(month)
  const inMonth = { gte: start, lt: end }
  switch (metric as ChallengeMetric) {
    case 'NEW_BEACHES':
      return prisma.discovery.count({ where: { userId, createdAt: inMonth, vendor: { category: 'BEACH' } } })
    case 'NEW_FOOD_SPOTS':
      return prisma.discovery.count({ where: { userId, createdAt: inMonth, vendor: { category: 'FOOD' } } })
    case 'NEW_PLACES':
      return prisma.discovery.count({ where: { userId, createdAt: inMonth, type: { in: ['VENDOR', 'PHOTOSPOT', 'HIDDEN_GEM'] } } })
    case 'CHECKINS':
      return prisma.checkIn.count({ where: { userId, createdAt: inMonth } })
    case 'PHOTO_SPOTS':
      return prisma.discovery.count({ where: { userId, createdAt: inMonth, photoSpotId: { not: null } } })
    case 'HIDDEN_GEMS':
      return prisma.gemConfirmation.count({ where: { userId, confirmedAt: inMonth } })
    default:
      return 0
  }
}

/** Pays out any of this month's challenges the user has just finished. Returns their titles. */
export async function evaluateChallenges(userId: string): Promise<string[]> {
  const month = monthKey()
  const challenges = await prisma.challenge.findMany({
    where: { month, active: true, completions: { none: { userId } } },
    select: { id: true, title: true, metric: true, target: true, bonusPoints: true }
  })
  const done: string[] = []
  for (const c of challenges) {
    if ((await progressFor(userId, c.metric, month)) < c.target) continue
    try {
      await prisma.$transaction([
        prisma.challengeCompletion.create({ data: { challengeId: c.id, userId, pointsAwarded: c.bonusPoints } }),
        prisma.user.update({ where: { id: userId }, data: { points: { increment: c.bonusPoints } } })
      ])
      done.push(c.title)
    } catch {
      // Completed concurrently (unique constraint) — already paid.
    }
  }
  return done
}

/** Points earned this month from check-ins, discoveries and challenge bonuses. */
export async function monthPoints(userIds: string[], month = monthKey()): Promise<Map<string, number>> {
  const { start, end } = monthBounds(month)
  const where = { userId: { in: userIds }, createdAt: { gte: start, lt: end } }
  const [checkins, discoveries, bonuses] = await Promise.all([
    prisma.checkIn.groupBy({ by: ['userId'], where, _sum: { points: true } }),
    prisma.discovery.groupBy({ by: ['userId'], where, _sum: { points: true } }),
    prisma.challengeCompletion.groupBy({ by: ['userId'], where: { userId: { in: userIds }, completedAt: { gte: start, lt: end } }, _sum: { pointsAwarded: true } })
  ])
  const totals = new Map<string, number>()
  const add = (id: string, n: number | null | undefined) => totals.set(id, (totals.get(id) ?? 0) + (n ?? 0))
  checkins.forEach(r => add(r.userId, r._sum.points))
  discoveries.forEach(r => add(r.userId, r._sum.points))
  bonuses.forEach(r => add(r.userId, r._sum.pointsAwarded))
  return totals
}
