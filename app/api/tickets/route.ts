// GET — the signed-in user's event tickets (My Bookings).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to see your tickets' })
  if (!auth.ok) return auth.response
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      include: { event: { select: { id: true, title: true, venueName: true, startAt: true, endAt: true, imageUrl: true, lat: true, lng: true, city: true } } }
    })
    return NextResponse.json(tickets)
  } catch (error) {
    console.error('Error fetching tickets:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
