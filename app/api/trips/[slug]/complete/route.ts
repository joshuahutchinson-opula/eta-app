import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasEditKey, loadTrip, toTripDTO } from '@/lib/trips'
import { onBookingCompleted } from '@/lib/booking-events'

export const dynamic = 'force-dynamic'

// POST + editKey — the owner finishes a booked trip. Marks the trip and its
// booking COMPLETED (crediting points exactly once) and unlocks the recap.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { booking: { select: { id: true, status: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!hasEditKey(trip, request, body)) return NextResponse.json({ error: 'Only the trip owner can finish the trip' }, { status: 403 })
    if (trip.status !== 'BOOKED' && trip.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Book the trip before finishing it' }, { status: 409 })
    }

    if (trip.status === 'BOOKED') {
      const completedNow = await prisma.$transaction(async tx => {
        await tx.trip.update({ where: { id: trip.id }, data: { status: 'COMPLETED' } })
        if (trip.booking && trip.booking.status !== 'COMPLETED') {
          await tx.booking.update({ where: { id: trip.booking.id }, data: { status: 'COMPLETED' } })
          return true
        }
        return false
      })
      if (completedNow && trip.booking) await onBookingCompleted(trip.booking.id)
    }

    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!), canEdit: true })
  } catch (error) {
    console.error('Error completing trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
