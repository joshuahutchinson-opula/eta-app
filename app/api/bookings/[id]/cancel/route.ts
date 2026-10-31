// GET  — what cancelling now would refund (for the confirm sheet).
// POST — cancel your own booking. The refund follows the experience's or
// stay's cancellation tier (lib/cancellation.ts), goes back to the ETA
// Wallet (placeholder payments) as a REFUND transaction, and the booking
// becomes CANCELLED. A booked crew trip is cancelled with it.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { parseTier, refundAmount, refundShare } from '@/lib/cancellation'
import { notifyUser } from '@/lib/notify'
import { formatMoney } from '@/lib/money'

export const dynamic = 'force-dynamic'

class CancelError extends Error {}

async function load(id: string, userId: string) {
  const b = await prisma.booking.findUnique({
    where: { id },
    include: { experience: { select: { name: true, cancellationTier: true } }, accommodation: { select: { name: true, cancellationTier: true } }, trip: { select: { id: true, name: true } } }
  })
  return b && b.userId === userId ? b : null
}

/** What each person paid toward this booking (wallet payments minus refunds) — the
 *  owner, plus crew members who paid their share of a split trip. */
async function paidByUser(bookingId: string): Promise<Map<string, number>> {
  const rows = await prisma.transaction.findMany({ where: { bookingId, status: 'COMPLETED' }, select: { userId: true, amount: true, type: true } })
  const paid = new Map<string, number>()
  for (const r of rows) paid.set(r.userId, (paid.get(r.userId) ?? 0) + (r.type === 'REFUND' ? -r.amount : r.type === 'PAYMENT' ? r.amount : 0))
  paid.forEach((v, k) => paid.set(k, Math.max(0, Math.round(v * 100) / 100)))
  return paid
}

async function paidFor(bookingId: string, userId: string): Promise<number> {
  return (await paidByUser(bookingId)).get(userId) ?? 0
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const b = await load(params.id, auth.user.id)
  if (!b) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  const tier = parseTier(b.experience?.cancellationTier ?? b.accommodation?.cancellationTier)
  const paid = await paidFor(b.id, auth.user.id)
  return NextResponse.json({ tier, paid, share: refundShare(tier, b.date), refund: refundAmount(tier, paid, b.date), cancellable: b.status === 'CONFIRMED' || b.status === 'PENDING' })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const b = await load(params.id, auth.user.id)
    if (!b) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (b.status !== 'CONFIRMED' && b.status !== 'PENDING') return NextResponse.json({ error: 'This booking can’t be cancelled' }, { status: 409 })
    const tier = parseTier(b.experience?.cancellationTier ?? b.accommodation?.cancellationTier)
    const paidMap = await paidByUser(b.id)
    const refunds = Array.from(paidMap.entries()).map(([userId, amount]) => ({ userId, refund: refundAmount(tier, amount, b.date) })).filter(r => r.refund > 0)
    const refund = refunds.find(r => r.userId === auth.user.id)?.refund ?? 0
    const title = b.experience?.name ?? b.accommodation?.name ?? b.trip?.name ?? 'Booking'

    const result = await prisma.$transaction(async tx => {
      const done = await tx.booking.updateMany({ where: { id: b.id, status: { in: ['CONFIRMED', 'PENDING'] } }, data: { status: 'CANCELLED', cancelledAt: new Date(), refundAmount: refund } })
      if (!done.count) throw new CancelError('Already cancelled')
      if (b.trip) await tx.trip.update({ where: { id: b.trip.id }, data: { status: 'CANCELLED' } })
      let refundTransactionId: string | null = null
      for (const r of refunds) {
        await tx.user.update({ where: { id: r.userId }, data: { walletBalance: { increment: r.refund } } })
        const row = await tx.transaction.create({ data: { userId: r.userId, bookingId: b.id, amount: r.refund, type: 'REFUND', status: 'COMPLETED', rail: 'ETA Wallet', description: `Refund · ${title}` } })
        if (r.userId === auth.user.id) refundTransactionId = row.id
      }
      const user = await tx.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } })
      return { refund, refundTransactionId, walletBalance: user?.walletBalance ?? null }
    })
    await notifyUser(auth.user.id, 'bookings', `booking:${b.id}:cancelled`, {
      title: `Cancelled: ${title}`,
      body: refund > 0 ? `${formatMoney(refund, 'USD')} is back in your ETA Wallet.` : 'No refund under this booking’s cancellation policy.',
      url: '/bookings'
    }).catch(() => {})
    for (const r of refunds) {
      if (r.userId === auth.user.id) continue
      await notifyUser(r.userId, 'crew', `booking:${b.id}:cancelled`, { title: `Cancelled: ${title}`, body: `${formatMoney(r.refund, 'USD')} of your share is back in your ETA Wallet.`, url: '/wallet' }).catch(() => {})
    }
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof CancelError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Error cancelling booking:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
