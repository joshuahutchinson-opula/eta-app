import { NextResponse } from 'next/server'
import { pushConfigured, runAlertSweep } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

// POST /api/alerts/sweep — catch-up pass for live vendors and active flash
// deals. Point a scheduler (e.g. a Railway cron hitting this every few
// minutes) at it. When CRON_SECRET is set, the x-cron-secret header must match.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('x-cron-secret') !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!pushConfigured()) {
    return NextResponse.json({ error: 'Push is not configured (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY missing)' }, { status: 503 })
  }
  try {
    return NextResponse.json(await runAlertSweep())
  } catch (error) {
    console.error('Alert sweep failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
