import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canCollaborate, loadTrip, toTripDTO } from '@/lib/trips'

export const dynamic = 'force-dynamic'

// POST { stopId, memberId, value: 1 | -1 } — voting the same way twice clears the vote.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const value = body.value === 1 || body.value === -1 ? body.value : null
    if (!value || typeof body.stopId !== 'string' || typeof body.memberId !== 'string') {
      return NextResponse.json({ error: 'stopId, memberId and value (1 or -1) are required' }, { status: 400 })
    }
    const trip = await prisma.trip.findUnique({
      where: { slug: params.slug },
      include: { stops: { select: { id: true } }, members: { select: { id: true } } }
    })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (trip.status !== 'PLANNING') return NextResponse.json({ error: 'Voting closes once the trip is booked' }, { status: 409 })
    if (!canCollaborate(trip, request, body)) return NextResponse.json({ error: 'This trip can’t be changed' }, { status: 403 })
    if (!trip.stops.some(s => s.id === body.stopId) || !trip.members.some(m => m.id === body.memberId)) {
      return NextResponse.json({ error: 'Unknown stop or crew member' }, { status: 400 })
    }

    const existing = await prisma.tripVote.findUnique({ where: { stopId_memberId: { stopId: body.stopId, memberId: body.memberId } } })
    if (existing && existing.value === value) {
      await prisma.tripVote.delete({ where: { id: existing.id } })
    } else {
      await prisma.tripVote.upsert({
        where: { stopId_memberId: { stopId: body.stopId, memberId: body.memberId } },
        create: { stopId: body.stopId, memberId: body.memberId, value },
        update: { value }
      })
    }
    const full = await loadTrip(params.slug)
    return NextResponse.json(toTripDTO(full!))
  } catch (error) {
    console.error('Error voting:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
