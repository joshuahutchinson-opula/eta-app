// POST /api/cron/reminders — booking reminders (day before, one hour
// before), event reminders, and the daily exchange-rate refresh. Point a
// scheduler at it every 15 minutes with the x-cron-secret header (same
// CRON_SECRET as /api/alerts/sweep). Safe to run as often as you like.
import { NextResponse } from 'next/server'
import { cronAuthorized } from '@/lib/cron'
import { runBookingReminders, runEventReminders } from '@/lib/booking-notify'
import { getUsdToJmd } from '@/lib/exchange-rate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const denied = cronAuthorized(request)
  if (denied) return denied
  try {
    const [bookings, events, rate] = await Promise.all([runBookingReminders(), runEventReminders(), getUsdToJmd()])
    return NextResponse.json({ bookings, events, usdToJmd: rate.rate })
  } catch (error) {
    console.error('Reminder job failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
