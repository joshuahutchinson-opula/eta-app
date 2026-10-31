import { NextResponse } from 'next/server'
import { pushConfigured, runAlertSweep } from '@/lib/alerts'
import { cronAuthorized } from '@/lib/cron'

export const dynamic = 'force-dynamic'

// POST /api/alerts/sweep — catch-up pass for live vendors and active flash
// deals. Point a scheduler (e.g. a Railway cron hitting this every few
// minutes) at it. The x-cron-secret header must match CRON_SECRET; with no
// CRON_SECRET configured the route refuses every call.
export async function POST(request: Request) {
  const denied = cronAuthorized(request)
  if (denied) return denied
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
