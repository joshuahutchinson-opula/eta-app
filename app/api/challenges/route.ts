// GET ?city= — this month's challenges. Signed in: each with your progress,
// and any you've just finished are paid out first (lib/challenges.ts).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { evaluateChallenges, monthKey, progressFor } from '@/lib/challenges'
import { isCityCode } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const userId = userIdFromRequest(request)
  const city = new URL(request.url).searchParams.get('city')
  const month = monthKey()
  try {
    const completedNow = userId ? await evaluateChallenges(userId) : []
    const challenges = await prisma.challenge.findMany({
      where: { month, active: true, ...(isCityCode(city) ? { OR: [{ city: null }, { city }] } : {}) },
      orderBy: { bonusPoints: 'asc' },
      include: userId ? { completions: { where: { userId }, select: { completedAt: true } } } : undefined
    })
    const rows = await Promise.all(challenges.map(async c => {
      const done = Boolean((c as typeof c & { completions?: unknown[] }).completions?.length)
      return {
        id: c.id, title: c.title, description: c.description, target: c.target, bonusPoints: c.bonusPoints,
        progress: userId ? Math.min(c.target, await progressFor(userId, c.metric, month)) : 0,
        completed: done
      }
    }))
    return NextResponse.json({ month, challenges: rows, completedNow })
  } catch (error) {
    console.error('Error fetching challenges:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
