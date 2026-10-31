import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { loadTrip, toTripDTO, tripAccess } from '@/lib/trips'
import { jamaicaDateTime, jamaicaToday, priceBreakdown } from '@/lib/pricing'
import { payFromWallet, WalletError } from '@/lib/wallet-pay'
import { assertSlotAvailable, SlotError } from '@/lib/slots'
import { onBookingCreated } from '@/lib/booking-notify'
import { notifyUser } from '@/lib/notify'
import { dateOnly, hhmm, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  editKey: z.string().max(64).optional(),
  date: dateOnly.optional(),
  time: hhmm.nullable().optional(),
  partySize: z.number().int().min(1).max(30).default(1),
  payWithWallet: z.boolean().default(true),
  estimatedPrice: z.number().finite().min(0).max(5000).optional(),
  // Each crew member pays their own share through the trip link.
  split: z.boolean().default(false)
})

// POST — the owner books a planned trip: a CONFIRMED Booking with the
// traveler's date, time and party size (checked against the slot's
// capacity). Paid from the ETA Wallet placeholder — the whole total, or with
// split, just the owner's share; the rest of the crew pays theirs through
// /pay-share.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to book this trip' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  try {
    const trip = await prisma.trip.findUnique({
      where: { slug: params.slug },
      include: { experience: { select: { price: true, name: true } }, stops: { orderBy: { order: 'asc' }, select: { vendorId: true } }, members: { orderBy: { joinedAt: 'asc' } } }
    })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request, body)
    if (access.role !== 'owner') return NextResponse.json({ error: 'Only the trip owner can book' }, { status: 403 })
    if (trip.status !== 'PLANNING') {
      const full = await loadTrip(params.slug)
      return NextResponse.json({ ...toTripDTO(full!, access), canEdit: true })
    }
    const userId = auth.user.id

    // The traveler's pick; otherwise soon, so it lands in the Active Trip
    // banner's "happening now" window right after booking.
    const picked = body.date ? jamaicaDateTime(body.date, body.time ?? null) : null
    if (picked && picked.getTime() < Date.now()) return NextResponse.json({ error: 'That time has already passed — pick a later one' }, { status: 400 })
    const date = picked ?? (trip.date && trip.date.getTime() > Date.now() ? trip.date : new Date(Date.now() + 2 * 3600000))
    const split = body.split && trip.members.length > 1
    const partySize = split ? trip.members.length : body.partySize
    // Curated experiences have a set price; a generated route sends its per-person estimate.
    const unit = trip.experience?.price ?? Math.round(body.estimatedPrice ?? 0)
    const price = priceBreakdown(unit, partySize)
    const perPerson = priceBreakdown(unit, 1)
    const firstVendor = trip.stops.find(s => s.vendorId)?.vendorId ?? null
    const owner = trip.members.find(m => m.isOwner)

    const result = await prisma.$transaction(async tx => {
      if (trip.experienceId) await assertSlotAvailable(tx, trip.experienceId, body.date ?? jamaicaToday(), body.time ?? null, partySize)
      const booking = await tx.booking.create({
        data: {
          userId,
          experienceId: trip.experienceId,
          vendorId: trip.experienceId ? null : firstVendor,
          date,
          time: body.time ?? null,
          partySize,
          unitPrice: unit,
          fees: price.fees,
          totalPrice: price.total,
          pointsEarned: Math.floor(price.subtotal),
          status: 'CONFIRMED'
        }
      })
      const charge = split ? perPerson.total : price.total
      const payment = body.payWithWallet && charge > 0
        ? await payFromWallet(tx, { userId, amount: charge, fees: split ? perPerson.fees : price.fees, description: `${trip.experience?.name ?? trip.name}${split ? ' · your share' : ''}`, bookingId: booking.id, vendorId: firstVendor })
        : null
      await tx.trip.update({ where: { id: trip.id }, data: { status: 'BOOKED', bookingId: booking.id, date, ownerId: trip.ownerId ?? userId, splitPayment: split } })
      if (split) {
        await tx.tripMember.updateMany({ where: { tripId: trip.id }, data: { share: perPerson.total, paid: false, paidAt: null } })
        if (owner && payment) await tx.tripMember.update({ where: { id: owner.id }, data: { paid: true, paidAt: new Date(), paidTransactionId: payment.id } })
      } else if (payment) {
        await tx.tripMember.updateMany({ where: { tripId: trip.id }, data: { paid: true, paidAt: new Date() } })
      }
      return { bookingId: booking.id, transactionId: payment?.id ?? null }
    })
    await onBookingCreated(result.bookingId, result.transactionId)
    if (split) {
      for (const m of trip.members) {
        if (m.userId && m.userId !== userId) {
          await notifyUser(m.userId, 'crew', `trip:${trip.id}:pay`, { title: `${trip.name} is booked`, body: `Pay your share from the trip link.`, url: `/trip/${trip.slug}` }).catch(() => {})
        }
      }
    }
    const full = await loadTrip(params.slug)
    const wallet = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } })
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: true, ...result, walletBalance: wallet?.walletBalance ?? null })
  } catch (error) {
    if (error instanceof WalletError) return NextResponse.json({ error: error.message }, { status: 402 })
    if (error instanceof SlotError) return NextResponse.json({ error: error.message, code: 'SLOT_UNAVAILABLE' }, { status: 409 })
    console.error('Error booking trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
