// POST { checkIn, checkOut, guests } (signed in) — book a stay: re-checks
// availability, charges nightly price × nights (+ fee) to the ETA Wallet
// placeholder, and records the booking and its receipt.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { nightsOf, unavailableNights } from '@/lib/availability'
import { priceBreakdown } from '@/lib/pricing'
import { payFromWallet, WalletError } from '@/lib/wallet-pay'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in to book' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const checkIn = String(body.checkIn ?? '')
  const checkOut = String(body.checkOut ?? '')
  const nights = nightsOf(checkIn, checkOut).length
  if (nights === 0) return NextResponse.json({ error: 'Pick a check-out after check-in' }, { status: 400 })

  try {
    const stay = await prisma.accommodation.findUnique({ where: { id: params.id }, select: { id: true, name: true, nightlyPrice: true, maxGuests: true } })
    if (!stay) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (stay.nightlyPrice == null) return NextResponse.json({ error: 'This stay hasn’t listed a nightly price yet' }, { status: 409 })
    const guests = Math.max(1, Math.min(stay.maxGuests ?? 20, Math.round(Number(body.guests) || 1)))
    const taken = await unavailableNights(stay.id, checkIn, checkOut)
    if (taken.length) return NextResponse.json({ error: 'Some of those nights just got booked — pick other dates', unavailable: taken }, { status: 409 })

    const price = priceBreakdown(stay.nightlyPrice, nights)
    const result = await prisma.$transaction(async tx => {
      const booking = await tx.booking.create({
        data: {
          userId, accommodationId: stay.id,
          // Check-in 3 pm, check-out 11 am, Jamaica time (UTC-5).
          date: new Date(`${checkIn}T20:00:00Z`), endDate: new Date(`${checkOut}T16:00:00Z`),
          partySize: guests, unitPrice: stay.nightlyPrice, fees: price.fees,
          totalPrice: price.total, pointsEarned: Math.floor(price.subtotal / 10), status: 'CONFIRMED'
        }
      })
      const payment = await payFromWallet(tx, { userId, amount: price.total, fees: price.fees, description: `${stay.name} · ${nights} ${nights === 1 ? 'night' : 'nights'}`, bookingId: booking.id })
      return { bookingId: booking.id, transactionId: payment.id }
    })
    const wallet = await prisma.user.findUnique({ where: { id: userId }, select: { walletBalance: true } })
    return NextResponse.json({ ...result, walletBalance: wallet?.walletBalance ?? null })
  } catch (error) {
    if (error instanceof WalletError) return NextResponse.json({ error: error.message }, { status: 402 })
    console.error('Error booking stay:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
