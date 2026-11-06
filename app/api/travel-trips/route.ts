// /api/travel-trips — the traveler's trips to Jamaica (lib/travel-trips.ts).
// GET  (signed in) → { trips, travelerType, explored: { CITY: % }, cruise }
//      every trip they own or joined (upcoming, on now, past), plus what the
//      stage needs (lib/stage.ts) and how much of each town they've explored.
// POST { kind?, city, start, end, stayName?, stayCity?, stayAccommodationId?,
//        stayLat?, stayLng?, arrivalAirport?, legs?: [{ city, start, end }],
//        status?: "ACTIVE" } → the new trip (201).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { createTrip, exploredByTown, tripsFor, TripError } from '@/lib/travel-trips'
import { CITY_CODES } from '@/lib/regions'
import { dateOnly, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const city = z.enum(CITY_CODES as [string, ...string[]])

const tripSchema = z.object({
  kind: z.enum(['VISIT', 'GETAWAY']).optional(),
  city,
  start: dateOnly,
  end: dateOnly,
  stayName: text(120).nullable().optional(),
  stayCity: city.nullable().optional(),
  stayAccommodationId: z.string().max(64).nullable().optional(),
  stayLat: z.number().finite().min(-90).max(90).nullable().optional(),
  stayLng: z.number().finite().min(-180).max(180).nullable().optional(),
  partnerPropertyId: z.string().max(64).nullable().optional(),
  arrivalAirport: z.enum(['MBJ', 'KIN', 'OCJ', 'NEG']).nullable().optional(),
  legs: z.array(z.object({ city, start: dateOnly, end: dateOnly })).max(8).optional(),
  status: z.enum(['UPCOMING', 'ACTIVE']).optional()
})

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const [trips, user, explored] = await Promise.all([
      tripsFor(auth.user.id),
      prisma.user.findUnique({ where: { id: auth.user.id }, select: { travelerType: true, cruisePort: true, cruiseDay: true, cruiseAllAboardAt: true, stagePromptSnoozedUntil: true } }),
      exploredByTown(auth.user.id)
    ])
    return NextResponse.json({
      trips,
      travelerType: user?.travelerType ?? null,
      snoozedUntil: user?.stagePromptSnoozedUntil ?? null,
      cruise: user?.cruisePort && user.cruiseDay && user.cruiseAllAboardAt ? { port: user.cruisePort, day: user.cruiseDay, allAboardAt: user.cruiseAllAboardAt } : null,
      explored
    })
  } catch (error) {
    console.error('Trips failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to save your trip' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, tripSchema)
  if (!parsed.ok) return parsed.response
  try {
    const trip = await createTrip(auth.user.id, parsed.data)
    if (parsed.data.kind !== 'GETAWAY') await prisma.user.update({ where: { id: auth.user.id }, data: { travelerType: 'VISITOR' } }).catch(() => {})
    return NextResponse.json({ trip }, { status: 201 })
  } catch (error) {
    if (error instanceof TripError) return NextResponse.json({ error: error.message, code: 'INVALID_BODY' }, { status: error.status })
    console.error('Creating trip failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
