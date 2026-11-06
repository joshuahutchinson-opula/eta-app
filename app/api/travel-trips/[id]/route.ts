// /api/travel-trips/:id — one trip (lib/travel-trips.ts).
// GET    → the trip, and for a past trip its stats (places, sunsets,
//          % explored, points, three photos).
// PATCH  { start?, end?, city?, stay…?, legs?, kind?, arrivalAirport?,
//          status?: "UPCOMING" | "ACTIVE" | "ENDED" } → { trip, pending }.
//          On a group trip a date change waits for the others (pending).
//          ACTIVE = "I've arrived", ENDED = "the trip's over" — only ever
//          sent from a tap, never on a timer.
// DELETE → cancels it (owner) or leaves it (member). Home falls back to
//          Browsing / Between trips when the last upcoming trip goes.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { deleteTrip, pastTripStats, shape, tripFor, TripError, updateTrip } from '@/lib/travel-trips'
import { CITY_CODES } from '@/lib/regions'
import { dateOnly, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const city = z.enum(CITY_CODES as [string, ...string[]])
const patchSchema = z.object({
  kind: z.enum(['VISIT', 'GETAWAY']),
  city,
  start: dateOnly,
  end: dateOnly,
  stayName: text(120).nullable(),
  stayCity: city.nullable(),
  stayAccommodationId: z.string().max(64).nullable(),
  stayLat: z.number().finite().min(-90).max(90).nullable(),
  stayLng: z.number().finite().min(-180).max(180).nullable(),
  partnerPropertyId: z.string().max(64).nullable(),
  arrivalAirport: z.enum(['MBJ', 'KIN', 'OCJ', 'NEG']).nullable(),
  legs: z.array(z.object({ city, start: dateOnly, end: dateOnly })).max(8),
  status: z.enum(['UPCOMING', 'ACTIVE', 'ENDED'])
}).partial()

function fail(error: unknown) {
  if (error instanceof TripError) return NextResponse.json({ error: error.message, code: error.status === 404 ? 'NOT_FOUND' : 'INVALID_BODY' }, { status: error.status })
  console.error('Trip failed:', error)
  return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const t = await tripFor(auth.user.id, params.id)
    const past = t.status === 'ENDED' || t.endDate.getTime() + 86400000 < Date.now()
    return NextResponse.json({ trip: shape(t, auth.user.id), stats: past ? await pastTripStats(auth.user.id, t) : null })
  } catch (error) {
    return fail(error)
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, patchSchema)
  if (!parsed.ok) return parsed.response
  try {
    const result = await updateTrip(auth.user.id, params.id, parsed.data)
    if (parsed.data.status === 'ACTIVE') await prisma.user.update({ where: { id: auth.user.id }, data: { cruiseDay: null, cruisePort: null, cruiseAllAboardAt: null } }).catch(() => {})
    return NextResponse.json(result, { status: result.pending ? 202 : 200 })
  } catch (error) {
    return fail(error)
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    await deleteTrip(auth.user.id, params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return fail(error)
  }
}
