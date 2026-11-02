// POST { quantity } — buy in-app tickets for an event, paid from the ETA
// Wallet placeholder (the same as BookingSheet). Capacity is checked inside
// the payment transaction so the last tickets can't be sold twice.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { priceBreakdown } from '@/lib/pricing'
import { payFromWallet, WalletError } from '@/lib/wallet-pay'
import { MAX_TICKETS_PER_ORDER, ticketCode, ticketsLeft } from '@/lib/tickets'
import { notifyUser } from '@/lib/notify'
import { sendReceipt } from '@/lib/booking-notify'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

class TicketError extends Error {}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to get tickets' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ quantity: z.number().int().min(1).max(MAX_TICKETS_PER_ORDER) }))
  if (!parsed.ok) return parsed.response
  const { quantity } = parsed.data
  try {
    const event = await prisma.event.findUnique({ where: { id: params.id } })
    if (!event) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!event.inAppTickets) return NextResponse.json({ error: 'Tickets for this one are sold by the promoter' }, { status: 409 })
    if ((event.endAt ?? event.startAt).getTime() < Date.now()) return NextResponse.json({ error: 'This event is over' }, { status: 410 })
    const unit = event.isFree ? 0 : event.price
    if (unit === null) return NextResponse.json({ error: 'The ticket price isn’t listed yet' }, { status: 409 })
    const price = priceBreakdown(unit, quantity)

    const ticket = await prisma.$transaction(async tx => {
      const left = await ticketsLeft(event.id, event.ticketCapacity, tx)
      if (left !== null && left < quantity) throw new TicketError(left === 0 ? 'Sold out' : `Only ${left} ${left === 1 ? 'ticket' : 'tickets'} left`)
      const payment = price.total > 0
        ? await payFromWallet(tx, { userId: auth.user.id, amount: price.total, fees: price.fees, description: `${event.title} · ${quantity} ${quantity === 1 ? 'ticket' : 'tickets'}` })
        : null
      return tx.ticket.create({
        data: { eventId: event.id, userId: auth.user.id, quantity, unitPrice: unit, fees: price.fees, totalPrice: price.total, code: ticketCode(), transactionId: payment?.id ?? null }
      })
    })
    const when = event.startAt.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })
    await notifyUser(auth.user.id, 'bookings', `ticket:${ticket.id}:confirmed`, { title: `Tickets: ${event.title}`, body: `${when} · ${quantity} ${quantity === 1 ? 'ticket' : 'tickets'} · ${ticket.code}`, url: '/bookings' }).catch(() => {})
    if (ticket.transactionId) await sendReceipt(ticket.transactionId).catch(() => {})
    const wallet = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } })
    return NextResponse.json({ ticketId: ticket.id, code: ticket.code, transactionId: ticket.transactionId, walletBalance: wallet?.walletBalance ?? null }, { status: 201 })
  } catch (error) {
    if (error instanceof WalletError) return NextResponse.json({ error: error.message }, { status: 402 })
    if (error instanceof TicketError) return NextResponse.json({ error: error.message, code: 'SLOT_UNAVAILABLE' }, { status: 409 })
    console.error('Error selling tickets:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
