import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canCollaborate, cleanStopInput, hasEditKey, loadTrip, nextStopOrder, toTripDTO } from '@/lib/trips'

export const dynamic = 'force-dynamic'

// POST — add a stop (the "Add to trip" quick action, or a crew suggestion).
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!canCollaborate(trip, request, body)) return NextResponse.json({ error: 'This trip can’t be changed' }, { status: 403 })
    const input = cleanStopInput(body)
    if (!input) return NextResponse.json({ error: 'Pick one vendor, experience or photo spot' }, { status: 400 })

    const duplicate = await prisma.tripStop.findFirst({
      where: { tripId: trip.id, vendorId: input.vendorId ?? undefined, experienceId: input.experienceId ?? undefined, photoSpotId: input.photoSpotId ?? undefined }
    })
    if (!duplicate) {
      await prisma.tripStop.create({
        data: {
          ...input,
          tripId: trip.id,
          order: await nextStopOrder(trip.id),
          addedBy: typeof body.addedBy === 'string' ? body.addedBy.slice(0, 40) : null
        }
      })
      await prisma.trip.update({ where: { id: trip.id }, data: { updatedAt: new Date() } })
    }
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!), alreadyAdded: Boolean(duplicate) })
  } catch (error) {
    console.error('Error adding stop:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// PATCH { order: [stopId, ...] } or { stopId, time, note } — owner only.
export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { stops: { select: { id: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!hasEditKey(trip, request, body)) return NextResponse.json({ error: 'Only the trip owner can do that' }, { status: 403 })
    const ids = new Set(trip.stops.map(s => s.id))

    if (Array.isArray(body.order)) {
      const order = body.order.filter((id: unknown): id is string => typeof id === 'string' && ids.has(id))
      await prisma.$transaction(order.map((id: string, i: number) => prisma.tripStop.update({ where: { id }, data: { order: i } })))
    } else if (typeof body.stopId === 'string' && ids.has(body.stopId)) {
      await prisma.tripStop.update({
        where: { id: body.stopId },
        data: {
          ...(typeof body.time === 'string' ? { time: body.time.slice(0, 20) || null } : {}),
          ...(typeof body.note === 'string' ? { note: body.note.slice(0, 280) || null } : {})
        }
      })
    }
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!), canEdit: true })
  } catch (error) {
    console.error('Error updating stops:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// DELETE ?stopId= — owner only.
export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  try {
    const stopId = new URL(request.url).searchParams.get('stopId')
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!hasEditKey(trip, request)) return NextResponse.json({ error: 'Only the trip owner can do that' }, { status: 403 })
    if (trip.status !== 'PLANNING') return NextResponse.json({ error: 'Booked trips can’t lose stops' }, { status: 409 })
    if (stopId) await prisma.tripStop.deleteMany({ where: { id: stopId, tripId: trip.id } })
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!), canEdit: true })
  } catch (error) {
    console.error('Error removing stop:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
