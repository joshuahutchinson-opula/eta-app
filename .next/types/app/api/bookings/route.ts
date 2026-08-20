import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const bookings = await prisma.booking.findMany({
      include: { experience: true, vendor: true, accommodation: true },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(bookings)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId, experienceId, vendorId, accommodationId, date, totalPrice } = await request.json()
    const booking = await prisma.booking.create({
      data: {
        userId,
        experienceId,
        vendorId,
        accommodationId,
        date: new Date(date),
        totalPrice,
        pointsEarned: Math.floor(totalPrice),
        status: 'CONFIRMED'
      }
    })
    await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: Math.floor(totalPrice) } }
    })
    await prisma.transaction.create({
      data: {
        userId,
        vendorId,
        amount: totalPrice,
        type: 'PAYMENT',
        status: 'COMPLETED'
      }
    })
    return NextResponse.json(booking)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}