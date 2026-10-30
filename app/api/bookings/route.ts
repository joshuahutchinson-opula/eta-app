import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { onBookingCompleted } from '@/lib/booking-events'
import { userIdFromRequest } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

// GET — the signed-in caller's bookings only (Authorization: Bearer …),
// with what My Bookings needs: the trip behind it and its receipts.
export async function GET(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json([])
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      include: {
        experience: { select: { id: true, name: true, imageUrl: true, meetingPoint: true, city: true } },
        vendor: { select: { id: true, name: true, images: true, neighborhood: true } },
        accommodation: { select: { id: true, name: true, media: true, city: true } },
        trip: { select: { slug: true, status: true, name: true } },
        transactions: { select: { id: true, amount: true, status: true, createdAt: true }, orderBy: { createdAt: 'asc' } }
      }
    })
    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const booking = await prisma.booking.create({
      data: body
    })
    if (booking.status === 'COMPLETED') await onBookingCompleted(booking.id)
    return NextResponse.json(booking)
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}
