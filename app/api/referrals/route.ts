import { NextResponse } from 'next/server'
import { getReferralSummary } from '@/lib/referrals'

export const dynamic = 'force-dynamic'

// GET /api/referrals?userId= — the user's code (created on first request) and who they've invited.
export async function GET(request: Request) {
  try {
    const userId = new URL(request.url).searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    const summary = await getReferralSummary(userId)
    if (!summary.code) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error fetching referrals:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
