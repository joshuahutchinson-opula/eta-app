// POST — cancel your own event tickets. Tickets follow the "standard"
// cancellation tier (lib/cancellation.ts); the refund goes back to the ETA
// Wallet (placeholder payments) with a REFUND transaction as its receipt.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { refundAmount } from '@/lib/cancellation'

export const dynamic = 'force-dynamic'

class CancelError extends Error {}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const ticket = await prisma.ticket.findUnique({ where: { id: params.id }, include: { event: { select: { title: true, startAt: true } } } })
    if (!ticket || ticket.userId !== auth.user.id) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (ticket.status !== 'CONFIRMED') return NextResponse.json({ error: 'These tickets can’t be cancelled' }, { status: 409 })
    const refund = refundAmount('standard', ticket.totalPrice, ticket.event.startAt)
    const result = await prisma.$transaction(async tx => {
      const done = await tx.ticket.updateMany({ where: { id: ticket.id, status: 'CONFIRMED' }, data: { status: 'CANCELLED', cancelledAt: new Date(), refundAmount: refund } })
      if (!done.count) throw new CancelError('Already cancelled')
      let refundTx: string | null = null
      if (refund > 0) {
        await tx.user.update({ where: { id: auth.user.id }, data: { walletBalance: { increment: refund } } })
        refundTx = (await tx.transaction.create({ data: { userId: auth.user.id, amount: refund, type: 'REFUND', status: 'COMPLETED', rail: 'ETA Wallet', description: `Refund · ${ticket.event.title}` } })).id
      }
      const user = await tx.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } })
      return { refund, refundTransactionId: refundTx, walletBalance: user?.walletBalance ?? null }
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CancelError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Error cancelling tickets:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
