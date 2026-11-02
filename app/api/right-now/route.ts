// GET ?city=NEGRIL — Home's "Right now" strip: vendors open now (by their
// listed hours when they have them, otherwise the live open flag), vendors
// live now, and events starting within the next 3 hours.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { parseCity } from '@/lib/regions'
import { openState, parseHours } from '@/lib/hours'

export const dynamic = 'force-dynamic'

const SOON_MS = 3 * 3600000

export async function GET(request: Request) {
  const city = parseCity(new URL(request.url).searchParams.get('city'))
  const now = new Date()
  try {
    const [vendors, events] = await Promise.all([
      prisma.vendor.findMany({
        where: { city, visibleInMarketplace: true, isTransport: false },
        orderBy: [{ live: 'desc' }, { isPremium: 'desc' }, { whoThere: 'desc' }],
        select: { id: true, name: true, category: true, neighborhood: true, images: true, open: true, live: true, whoThere: true, hours: true }
      }),
      prisma.event.findMany({
        where: { city, startAt: { gte: now, lte: new Date(now.getTime() + SOON_MS) } },
        orderBy: { startAt: 'asc' },
        take: 6,
        select: { id: true, title: true, venueName: true, imageUrl: true, startAt: true }
      })
    ])
    const isOpen = (v: (typeof vendors)[number]) => {
      const hours = parseHours(v.hours)
      return hours ? openState(hours, now).open : v.open
    }
    const strip = ({ hours: _h, ...v }: (typeof vendors)[number]) => ({ ...v, image: v.images[0] ?? null, images: undefined })
    const live = vendors.filter(v => v.live).slice(0, 8).map(strip)
    const open = vendors.filter(v => !v.live && isOpen(v)).slice(0, 8).map(strip)
    return NextResponse.json({ live, open, events })
  } catch (error) {
    console.error('Error building right-now strip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
