// /api/trip-recap — the signed-in traveler's recap for their trip dates.
// GET              → the recap (trip dates from the account, or ?start=&end=).
// POST             → { token, url }: a public link to share it.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { buildRecap, recapToken } from '@/lib/trip-recap'
import { jamaicaDayStart } from '@/lib/trip-dates'
import { absoluteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

const DATE = /^\d{4}-\d{2}-\d{2}$/

async function tripDates(request: Request, userId: string): Promise<{ start: Date; end: Date } | null> {
  const q = new URL(request.url).searchParams
  const s = q.get('start')
  const e = q.get('end')
  if (s && e && DATE.test(s) && DATE.test(e)) return { start: jamaicaDayStart(s), end: jamaicaDayStart(e) }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tripStart: true, tripEnd: true } })
  return user?.tripStart && user.tripEnd ? { start: user.tripStart, end: user.tripEnd } : null
}

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const dates = await tripDates(request, auth.user.id)
  if (!dates) return NextResponse.json({ error: 'Add your travel dates first', code: 'NO_TRIP' }, { status: 404 })
  try {
    return NextResponse.json(await buildRecap(auth.user.id, dates.start, dates.end))
  } catch (error) {
    console.error('Recap failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const dates = await tripDates(request, auth.user.id)
  if (!dates) return NextResponse.json({ error: 'Add your travel dates first', code: 'NO_TRIP' }, { status: 404 })
  try {
    const token = await recapToken(auth.user.id, dates.start, dates.end)
    return NextResponse.json({ token, url: absoluteUrl(`/recap/${token}`) }, { status: 201 })
  } catch (error) {
    console.error('Recap share failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
