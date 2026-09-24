import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { onBookingCompleted } from '@/lib/booking-events'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true
          }
        },
        experience: true,
        vendor: true,
        accommodation: true
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