import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hasEditKey, loadTrip, toTripDTO } from '@/lib/trips'
import { jamaicaDateTime, priceBreakdown } from '@/lib/pricing'
import { payFromWallet, WalletError } from '@/lib/wallet-pay'

export const dynamic = 'force-dynamic'

// POST { userId, date?, time?, partySize?, payWithWallet?, estimatedPrice? } + editKey
// — book a planned trip. Creates a CONFIRMED Booking linked to the trip with
// the traveler's date, time and party size; with payWithWallet the total is
// taken from the ETA Wallet and a receipt (Transaction) is recorded.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const trip = await prisma.trip.findUnique({
      where: { slug: params.slug },
      include: { experience: { select: { price: true, name: true } }, stops: { orderBy: { order: 'asc' }, select: { vendorId: true } } }
    })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!hasEditKey(trip, request, body)) return NextResponse.json({ error: 'Only the trip owner can book' }, { status: 403 })
    if (trip.status !== 'PLANNING') {
      const full = await loadTrip(params.slug)
      return NextResponse.json({ ...toTripDTO(full!), canEdit: true })
    }
    const user = typeof body.userId === 'string'
      ? await prisma.user.findUnique({ where: { id: body.userId }, select: { id: true } })
      : null
    if (!user) return NextResponse.json({ error: 'Log in to book this trip' }, { status: 401 })

    // The traveler's pick; otherwise soon, so it lands in the Active Trip
    // banner's "happening now" window right after booking.
    const picked = typeof body.date === 'string' ? jamaicaDateTime(body.date, typeof body.time === 'string' ? body.time : null) : null
    const date = picked ?? (trip.date && trip.date.getTime() > Date.now() ? trip.date : new Date(Date.now() + 2 * 3600000))
    const partySize = Math.min(30, Math.max(1, Math.round(Number(body.partySize) || 1)))
    // Curated experiences have a set price; a generated route sends its per-person estimate.
    const estimate = Number(body.estimatedPrice)
    const unit = trip.experience?.price ?? (Number.isFinite(estimate) ? Math.min(5000, Math.max(0, Math.round(estimate))) : 0)
    const price = priceBreakdown(unit, partySize)
    const firstVendor = trip.stops.find(s => s.vendorId)?.vendorId ?? null

    const result = await prisma.$transaction(async tx => {
      const booking = await tx.booking.create({
        data: {
          userId: user.id,
          experienceId: trip.experienceId,
          vendorId: trip.experienceId ? null : firstVendor,
          date,
          time: typeof body.time === 'string' && /^\d{1,2}:\d{2}$/.test(body.time) ? body.time : null,
          partySize,
          unitPrice: unit,
          fees: price.fees,
          totalPrice: price.total,
          pointsEarned: Math.floor(price.subtotal),
          status: 'CONFIRMED'
        }
      })
      const payment = body.payWithWallet && price.total > 0
        ? await payFromWallet(tx, { userId: user.id, amount: price.total, fees: price.fees, description: trip.experience?.name ?? trip.name, bookingId: booking.id, vendorId: firstVendor })
        : null
      await tx.trip.update({
        where: { id: trip.id },
        data: { status: 'BOOKED', bookingId: booking.id, date, ownerId: trip.ownerId ?? user.id }
      })
      return { bookingId: booking.id, transactionId: payment?.id ?? null }
    })
    const full = await loadTrip(params.slug)
    const wallet = await prisma.user.findUnique({ where: { id: user.id }, select: { walletBalance: true } })
    return NextResponse.json({ ...toTripDTO(full!), canEdit: true, ...result, walletBalance: wallet?.walletBalance ?? null })
  } catch (error) {
    if (error instanceof WalletError) return NextResponse.json({ error: error.message }, { status: 402 })
    console.error('Error booking trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
