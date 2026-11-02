// GET — this month's leaderboard: people who opted in (Profile or Rewards),
// ranked by points earned this month, shown as first name + initial only.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { monthKey, monthPoints } from '@/lib/challenges'

export const dynamic = 'force-dynamic'

function displayName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/)
  const last = rest.pop()
  return last ? `${first} ${last[0].toUpperCase()}.` : first
}

export async function GET(request: Request) {
  const me = userIdFromRequest(request)
  try {
    const users = await prisma.user.findMany({ where: { leaderboardOptIn: true, deletedAt: null }, select: { id: true, name: true } })
    const points = await monthPoints(users.map(u => u.id))
    const ranked = users
      .map(u => ({ id: u.id, name: displayName(u.name), points: points.get(u.id) ?? 0 }))
      .filter(r => r.points > 0 || r.id === me)
      .sort((a, b) => b.points - a.points)
    const rows = ranked.slice(0, 20).map((r, i) => ({ rank: i + 1, name: r.name, points: r.points, me: r.id === me }))
    const mine = me ? ranked.findIndex(r => r.id === me) : -1
    return NextResponse.json({ month: monthKey(), rows, myRank: mine >= 0 ? mine + 1 : null })
  } catch (error) {
    console.error('Error building leaderboard:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
