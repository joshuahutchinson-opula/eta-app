// lib/leaderboard.ts — the monthly per-town leaderboard: points earned this
// month in the town (PointsLedger earns with that city), for people who
// opted in (User.leaderboardOptIn, off by default). Names are first name +
// initial only. The caller always sees their own rank, opted in or not.
import { prisma } from '@/lib/prisma'
import { monthBounds, monthKey } from '@/lib/challenges'
import type { CityCode } from '@/lib/regions'

export function displayName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/)
  const last = rest.pop()
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}

export interface BoardRow { rank: number; name: string; points: number; me: boolean }

export async function townLeaderboard(city: CityCode, me: string | null, top = 10) {
  const month = monthKey()
  const { start, end } = monthBounds(month)
  const sums = await prisma.pointsLedger.groupBy({
    by: ['userId'],
    where: { city: city as never, kind: 'earn', createdAt: { gte: start, lt: end }, user: { leaderboardOptIn: true, deletedAt: null } },
    _sum: { points: true },
    orderBy: { _sum: { points: 'desc' } },
    take: 200
  })
  const users = await prisma.user.findMany({ where: { id: { in: sums.map(s => s.userId) } }, select: { id: true, name: true } })
  const name = new Map(users.map(u => [u.id, displayName(u.name)]))
  const ranked = sums.map((s, i) => ({ rank: i + 1, userId: s.userId, name: name.get(s.userId) ?? '—', points: s._sum.points ?? 0 }))
  const rows: BoardRow[] = ranked.slice(0, top).map(r => ({ rank: r.rank, name: r.name, points: r.points, me: r.userId === me }))
  let mine: { rank: number | null; points: number } | null = null
  if (me) {
    const hit = ranked.find(r => r.userId === me)
    if (hit) mine = { rank: hit.rank, points: hit.points }
    else {
      const own = await prisma.pointsLedger.aggregate({ where: { userId: me, city: city as never, kind: 'earn', createdAt: { gte: start, lt: end } }, _sum: { points: true } })
      mine = { rank: null, points: own._sum.points ?? 0 }
    }
  }
  return { month, city, rows, mine }
}
