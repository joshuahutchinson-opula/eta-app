import { NextResponse } from 'next/server'
import { getReferralSummary } from '@/lib/referrals'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// GET — the signed-in user's code (created on first request) and who they've invited.
export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const summary = await getReferralSummary(auth.user.id)
    if (!summary.code) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return NextResponse.json(summary)
  } catch (error) {
    console.error('Error fetching referrals:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
