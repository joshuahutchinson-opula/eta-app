// app/api/events/route.ts — promoter events.
// GET ?city=NEGRIL&days=7            → events that haven't ended, starting within the window
// GET ?city=NEGRIL&window=tonight    → All Events filters (tonight|tomorrow|weekend|week)
// GET ?ids=a,b                       → specific events (Saved)
// &limit= caps the list. Each event carries its interested count.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isCityCode } from '@/lib/regions'
import { EVENT_WINDOWS, windowRange, type EventWindow } from '@/lib/event-windows'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const city = params.get('city')
  const ids = (params.get('ids') ?? '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 100)
  const window = params.get('window') as EventWindow | null
  const days = Math.min(31, Math.max(1, Number(params.get('days')) || 7))
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 40))
  const now = new Date()
  // Still on: hasn't ended, or (no end time) started in the last 6 hours.
  const notOver: Prisma.EventWhereInput = { OR: [{ endAt: { gte: now } }, { endAt: null, startAt: { gte: new Date(now.getTime() - 6 * 3600000) } }] }
  const range = window && EVENT_WINDOWS.includes(window) ? windowRange(window, now) : null
  try {
    const events = await prisma.event.findMany({
      where: ids.length
        ? { id: { in: ids } }
        : {
            city: isCityCode(city) ? city : undefined,
            AND: [
              notOver,
              range
                ? { OR: [{ startAt: { gte: range.from, lt: range.to } }, { startAt: { lt: range.from }, OR: [{ endAt: { gt: range.from } }] }] }
                : { startAt: { lte: new Date(now.getTime() + days * 86400000) } }
            ]
          },
      orderBy: { startAt: 'asc' },
      take: limit,
      include: { _count: { select: { interests: true } } }
    })
    return NextResponse.json(events.map(({ _count, ...e }) => ({ ...e, interestedCount: _count.interests })))
  } catch (error) {
    console.error('Error fetching events:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
