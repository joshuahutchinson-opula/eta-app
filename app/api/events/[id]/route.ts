// GET — one event, with its interested count, whether the caller is
// interested, and (for in-app tickets) how many are left.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { ticketsLeft } from '@/lib/tickets'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = userIdFromRequest(request)
  try {
    const event = await prisma.event.findUnique({
      where: { id: params.id },
      include: { vendor: { select: { id: true, name: true, images: true } }, _count: { select: { interests: true } } }
    })
    if (!event) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const mine = userId ? await prisma.eventInterest.findUnique({ where: { eventId_userId: { eventId: event.id, userId } }, select: { id: true } }) : null
    const { _count, ...rest } = event
    return NextResponse.json({
      ...rest,
      interestedCount: _count.interests,
      interested: Boolean(mine),
      ticketsLeft: event.inAppTickets ? await ticketsLeft(event.id, event.ticketCapacity) : null
    })
  } catch (error) {
    console.error('Error fetching event:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
