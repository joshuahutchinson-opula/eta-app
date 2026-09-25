import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasEditKey, loadTrip, toTripDTO } from '@/lib/trips'

export const dynamic = 'force-dynamic'

// POST { userId } + editKey — book a planned trip. Creates the same kind of
// CONFIRMED Booking the Experiences flow always has, linked to the trip.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const trip = await prisma.trip.findUnique({
      where: { slug: params.slug },
      include: { experience: { select: { price: true } }, stops: { orderBy: { order: 'asc' }, select: { vendorId: true } } }
    })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!hasEditKey(trip, request, body)) return NextResponse.json({ error: 'Only the trip owner can book' }, { status: 403 })
    if (trip.status !== 'PLANNING') {
      const full = await loadTrip(params.slug)
      return NextResponse.json({ ...toTripDTO(full!), canEdit: true })
    }
    const user = typeof body.userId === 'string'
      ? await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } })
      : null
    if (!user) return NextResponse.json({ error: 'Log in to book this trip' }, { status: 401 })

    // Scheduled soon unless a date was set, so it lands in the Active Trip
    // banner's "happening now" window right after booking (same as before).
    const date = trip.date && trip.date.getTime() > Date.now() ? trip.date : new Date(Date.now() + 2 * 3600000)
    // Curated experiences have a set price; a generated route sends its per-person estimate.
    const estimate = Number(body.estimatedPrice)
    const price = trip.experience?.price ?? (Number.isFinite(estimate) ? Math.min(5000, Math.max(0, Math.round(estimate))) : 0)
    const firstVendor = trip.stops.find(s => s.vendorId)?.vendorId ?? null

    await prisma.$transaction(async tx => {
      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          experienceId: trip.experienceId,
          vendorId: trip.experienceId ? null : firstVendor,
          date,
          totalPrice: price,
          pointsEarned: Math.floor(price),
          status: 'CONFIRMED'
        }
      })
      await tx.trip.update({
        where: { id: trip.id },
        data: { status: 'BOOKED', bookingId: booking.id, date, ownerId: trip.ownerId ?? user.id }
      })
    })
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!), canEdit: true })
  } catch (error) {
    console.error('Error booking trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
