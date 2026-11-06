// GET /api/travel-trips/:id/ride — the airport ride booked for the trip's
// arrival (a confirmed transfer around the arrival day), with what the
// arrival's "Your Driver Is Waiting" screen shows: driver name and photo,
// car and plate, where to meet, and numbers to call or WhatsApp.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { tripFor, TripError } from '@/lib/travel-trips'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const trip = await tripFor(auth.user.id, params.id)
    const booking = await prisma.booking.findFirst({
      where: { userId: auth.user.id, status: 'CONFIRMED', transferServiceId: { not: null }, date: { gte: new Date(trip.startDate.getTime() - 86400000), lt: new Date(trip.startDate.getTime() + 2 * 86400000) } },
      orderBy: { date: 'asc' },
      include: { transferService: true, vendor: { select: { name: true, phone: true, whatsapp: true } } }
    })
    if (!booking?.transferService) return NextResponse.json({ ride: null })
    const s = booking.transferService
    return NextResponse.json({
      ride: {
        vendor: { name: booking.vendor?.name ?? '', phone: booking.vendor?.phone ?? null, whatsapp: booking.vendor?.whatsapp ?? null },
        driverName: s.driverName, driverPhoto: s.driverPhoto, driverPhone: s.driverPhone,
        vehicle: s.vehicle, plate: s.plate, meetPoint: s.meetPoint, pickupAt: booking.date.toISOString()
      }
    })
  } catch (error) {
    if (error instanceof TripError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Trip ride failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
