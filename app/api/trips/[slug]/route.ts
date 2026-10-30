import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasEditKey, loadTrip, toTripDTO } from '@/lib/trips'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const trip = await loadTrip(params.slug)
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return NextResponse.json({ ...toTripDTO(trip), canEdit: hasEditKey(trip, request) })
  } catch (error) {
    console.error('Error fetching trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// PATCH — owner edits: name, date, notes, cancelling a trip still in planning,
// advancing currentStopIndex on a booked trip ("Arrived → next stop"), or
// swapStop { stopId, vendorId | photoSpotId } to change a stop mid-trip.
export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!hasEditKey(trip, request, body)) return NextResponse.json({ error: 'Only the trip owner can do that' }, { status: 403 })

    const data: { name?: string; date?: Date | null; notes?: string | null; status?: 'CANCELLED'; currentStopIndex?: number } = {}
    if (Number.isInteger(body.currentStopIndex) && body.currentStopIndex >= 0 && body.currentStopIndex <= 50) data.currentStopIndex = body.currentStopIndex
    const swap = body.swapStop
    if (swap && typeof swap.stopId === 'string' && (typeof swap.vendorId === 'string' || typeof swap.photoSpotId === 'string')) {
      await prisma.tripStop.updateMany({
        where: { id: swap.stopId, tripId: trip.id },
        data: typeof swap.vendorId === 'string'
          ? { vendorId: swap.vendorId, photoSpotId: null, experienceId: null }
          : { photoSpotId: swap.photoSpotId, vendorId: null, experienceId: null }
      })
    }
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim().slice(0, 80)
    if (body.date === null) data.date = null
    else if (typeof body.date === 'string' && !isNaN(Date.parse(body.date))) data.date = new Date(body.date)
    if (typeof body.notes === 'string') data.notes = body.notes.slice(0, 1000)
    if (body.status === 'CANCELLED' && trip.status === 'PLANNING') data.status = 'CANCELLED'

    await prisma.trip.update({ where: { id: trip.id }, data })
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!), canEdit: true })
  } catch (error) {
    console.error('Error updating trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
