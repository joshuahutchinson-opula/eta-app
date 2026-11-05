// GET /api/bookings/plan-b — the caller's upcoming outdoor bookings with
// rain forecast, each with indoor swaps (lib/plan-b.ts). Empty when the
// skies look fine.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { planBOffers } from '@/lib/plan-b'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json({ offers: await planBOffers(auth.user.id) })
  } catch (error) {
    console.error('Plan B check failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
