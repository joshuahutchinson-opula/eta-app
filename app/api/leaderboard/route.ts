// GET ?city=NEGRIL — this month's leaderboard for the town (lib/leaderboard.ts):
// opted-in people ranked by points earned there this month, first name +
// initial only, plus the caller's own rank.
import { NextResponse } from 'next/server'
import { userIdFromRequest } from '@/lib/auth-server'
import { isCityCode } from '@/lib/regions'
import { townLeaderboard } from '@/lib/leaderboard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')
  try {
    const board = await townLeaderboard(isCityCode(city) ? city : 'NEGRIL', userIdFromRequest(request), 20)
    return NextResponse.json({ ...board, myRank: board.mine?.rank ?? null })
  } catch (error) {
    console.error('Error building leaderboard:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
