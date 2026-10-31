// POST — a crew member pays their own share of a split-payment trip from
// their own ETA Wallet (the same placeholder as BookingSheet). Their member
// row is marked paid with the receipt; everyone sees who's paid.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { loadTrip, toTripDTO, tripAccess } from '@/lib/trips'
import { payFromWallet, WalletError } from '@/lib/wallet-pay'
import { sendReceipt } from '@/lib/booking-notify'
import { notifyUser } from '@/lib/notify'

export const dynamic = 'force-dynamic'

class ShareError extends Error {}

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to pay your share' })
  if (!auth.ok) return auth.response
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { experience: { select: { name: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request)
    const member = access.member
    if (!member || member.userId !== auth.user.id) return NextResponse.json({ error: 'Join the crew from your invite link first' }, { status: 403 })
    if (trip.status !== 'BOOKED' || !trip.splitPayment || !trip.bookingId) return NextResponse.json({ error: 'There’s nothing to pay on this trip yet' }, { status: 409 })

    const txId = await prisma.$transaction(async tx => {
      // Claim the share first, so paying twice can't happen.
      const claimed = await tx.tripMember.updateMany({ where: { id: member.id, paid: false }, data: { paid: true, paidAt: new Date() } })
      if (claimed.count === 0) throw new ShareError('You’ve already paid your share')
      const fresh = await tx.tripMember.findUniqueOrThrow({ where: { id: member.id }, select: { share: true } })
      const payment = await payFromWallet(tx, { userId: auth.user.id, amount: fresh.share, description: `${trip.experience?.name ?? trip.name} · your share`, bookingId: trip.bookingId! })
      await tx.tripMember.update({ where: { id: member.id }, data: { paidTransactionId: payment.id } })
      return payment.id
    })
    await sendReceipt(txId).catch(() => {})
    if (trip.ownerId && trip.ownerId !== auth.user.id) {
      await notifyUser(trip.ownerId, 'crew', `trip:${trip.id}:paid:${member.id}`, { title: `${member.name} paid their share`, body: trip.name, url: `/experiences?trip=${trip.slug}` }).catch(() => {})
    }
    const full = await loadTrip(params.slug)
    const wallet = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } })
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: access.role === 'owner', transactionId: txId, walletBalance: wallet?.walletBalance ?? null })
  } catch (error) {
    if (error instanceof WalletError) return NextResponse.json({ error: error.message }, { status: 402 })
    if (error instanceof ShareError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Error paying share:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
