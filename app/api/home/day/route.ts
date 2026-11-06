// GET /api/home/day (signed in) — Home's "Your Day" (lib/home.ts yourDay):
// everything on today in order (bookings, rides, tickets, trip stops, with
// photos, QR and crew), what's still to come, and today's check-ins for the
// night recap.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { yourDay } from '@/lib/home'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json(await yourDay(auth.user.id))
  } catch (error) {
    console.error('Your day failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
