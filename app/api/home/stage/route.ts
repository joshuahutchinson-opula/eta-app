// GET /api/home/stage — the top of Home for a trip stage (lib/home-stage.ts).
//   ?stage=countdown&cities=NEGRIL,KINGSTON&start=&end=[&trip=]
//     → events on during the trip, Book Ahead, the gift waiting, and (signed
//       in, returning to a town they know) Places You Haven't Tried / Saved
//       Last Time. Guests send the dates of the trip kept on their device.
//   ?stage=cruise&port=OCHO_RIOS → rides back to the port.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { countdownExtras, cruiseExtras } from '@/lib/home-stage'
import { isCityCode, type CityCode } from '@/lib/regions'

export const dynamic = 'force-dynamic'

const DAY = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  try {
    if (q.get('stage') === 'cruise') {
      const port = q.get('port')
      if (!isCityCode(port)) return NextResponse.json({ error: 'port is required' }, { status: 400 })
      return NextResponse.json(await cruiseExtras(port))
    }
    const cities = (q.get('cities') ?? '').split(',').filter(isCityCode) as CityCode[]
    const start = q.get('start') ?? ''
    const end = q.get('end') ?? ''
    if (!cities.length || !DAY.test(start) || !DAY.test(end) || end < start) return NextResponse.json({ error: 'cities, start and end are required' }, { status: 400 })
    const userId = userIdFromRequest(request)
    let returning = false
    let visitedTown = false
    if (userId) {
      const past = await prisma.travelTrip.findMany({
        where: { status: { not: 'CANCELLED' }, endDate: { lt: new Date(Date.parse(`${start}T00:00:00-05:00`)) }, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        select: { city: true, legs: { select: { city: true } } }
      })
      returning = past.length > 0
      visitedTown = past.some(p => cities.includes(p.city as CityCode) || p.legs.some(l => cities.includes(l.city as CityCode)))
    }
    return NextResponse.json({ returning, visitedTown, ...(await countdownExtras({ cities, start, end, userId, returning, visitedTown })) })
  } catch (error) {
    console.error('Home stage failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
