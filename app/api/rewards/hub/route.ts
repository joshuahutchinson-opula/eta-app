// GET ?city=NEGRIL — everything the Rewards hub shows besides the catalog:
// status (tier from lifetime points, points to spend, progress), today's
// boosts in the town, the town's Give Back cause, badges (with the "one
// more to unlock" nudge), the town leaderboard, active voucher count and
// how many indoor spots the town has (the rainy-day card).
// Signed-out callers get the town parts only.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { isCityCode } from '@/lib/regions'
import { todaysBoosts } from '@/lib/boosts'
import { badgesFor } from '@/lib/badges'
import { townLeaderboard } from '@/lib/leaderboard'
import { causeFor } from '@/lib/causes'
import { getTierForPoints, tierProgress } from '@/lib/rewardTiers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('city')
  const city = isCityCode(q) ? q : 'NEGRIL'
  const userId = userIdFromRequest(request)
  try {
    const user = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { points: true, lifetimePoints: true, tierSeen: true, leaderboardOptIn: true, birthday: true, travelerType: true } }) : null
    const [boosts, cause, badges, board, vouchers, indoorSpots] = await Promise.all([
      todaysBoosts(city).catch(() => []),
      causeFor(city),
      user && userId ? badgesFor(userId).then(b => b.badges) : Promise.resolve([]),
      townLeaderboard(city, userId),
      userId ? prisma.redemption.count({ where: { userId, status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }) : Promise.resolve(0),
      prisma.vendor.count({ where: { city, indoor: true, visibleInMarketplace: true } })
    ])
    const status = user ? {
      points: user.points,
      lifetimePoints: user.lifetimePoints,
      tier: getTierForPoints(user.lifetimePoints).key,
      tierSeen: user.tierSeen,
      ...tierProgress(user.lifetimePoints),
      next: tierProgress(user.lifetimePoints).next?.key ?? null,
      leaderboardOptIn: user.leaderboardOptIn,
      birthday: user.birthday,
      local: user.travelerType === 'LOCAL'
    } : null
    return NextResponse.json({ city, status, boosts, cause, badges, leaderboard: board, activeVouchers: vouchers, indoorSpots })
  } catch (error) {
    console.error('Error building rewards hub:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
