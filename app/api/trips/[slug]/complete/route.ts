import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadTrip, toTripDTO, tripAccess } from '@/lib/trips'
import { onBookingCompleted } from '@/lib/booking-events'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// POST — the owner finishes a booked trip. Marks the trip and its booking
// COMPLETED (crediting points exactly once), stops live location sharing and
// unlocks the recap.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const parsed = await parseBody(request, z.object({ editKey: z.string().max(64).optional() }))
    if (!parsed.ok) return parsed.response
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { booking: { select: { id: true, status: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request, parsed.data)
    if (access.role !== 'owner') return NextResponse.json({ error: 'Only the trip owner can finish the trip' }, { status: 403 })
    if (trip.status !== 'BOOKED' && trip.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Book the trip before finishing it' }, { status: 409 })
    }

    if (trip.status === 'BOOKED') {
      const completedNow = await prisma.$transaction(async tx => {
        await tx.trip.update({ where: { id: trip.id }, data: { status: 'COMPLETED' } })
        await tx.tripMember.updateMany({ where: { tripId: trip.id }, data: { sharingLocation: false, lat: null, lng: null, locationAt: null } })
        if (trip.booking && trip.booking.status !== 'COMPLETED') {
          await tx.booking.update({ where: { id: trip.booking.id }, data: { status: 'COMPLETED' } })
          return true
        }
        return false
      })
      if (completedNow && trip.booking) await onBookingCompleted(trip.booking.id)
    }

    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: true })
  } catch (error) {
    console.error('Error completing trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
