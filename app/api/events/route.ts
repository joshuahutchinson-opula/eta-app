// app/api/events/route.ts — promoter events for This Week's Events.
// GET ?city=NEGRIL&days=7 → events that haven't ended, starting within the window.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCityCode } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const city = params.get('city')
  const days = Math.min(31, Math.max(1, Number(params.get('days')) || 7))
  const now = new Date()
  try {
    const events = await prisma.event.findMany({
      where: {
        city: isCityCode(city) ? city : undefined,
        startAt: { lte: new Date(now.getTime() + days * 86400000) },
        // Still on: hasn't ended, or (no end time) started in the last 6 hours.
        OR: [{ endAt: { gte: now } }, { endAt: null, startAt: { gte: new Date(now.getTime() - 6 * 3600000) } }]
      },
      orderBy: { startAt: 'asc' },
      take: 40
    })
    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
