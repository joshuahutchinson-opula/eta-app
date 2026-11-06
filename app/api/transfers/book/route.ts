// POST /api/transfers/book { serviceId, lat, lng, dropoff, partySize, payWith, pickupAt? }
// (signed in, verified) — book a vetted airport transfer at its fixed price,
// priced again on the server. payWith "wallet" pays now from the ETA Wallet;
// "driver" confirms the ride and the guest pays the driver that fixed price.
// The ride is shared with ETA (a confirmed booking with pickup and drop-off).
// pickupAt (ISO) books ahead for the arrival (the countdown's "Book Your
// Ride"); without it the ride leaves as soon as it's ready.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { airportByCode, fareFor, roadTrip } from '@/lib/transfers'
import { payFromWallet, WalletError } from '@/lib/wallet-pay'
import { onBookingCreated } from '@/lib/booking-notify'
import { id, lat, lng, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  serviceId: id,
  lat,
  lng,
  dropoff: text(160).min(1),
  partySize: z.number().int().min(1).max(30).default(1),
  payWith: z.enum(['wallet', 'driver']).default('driver'),
  pickupAt: z.string().datetime().optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to book your ride' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const b = parsed.data
  try {
    const service = await prisma.transferService.findFirst({ where: { id: b.serviceId, active: true }, include: { vendor: { select: { id: true, name: true } } } })
    const airport = airportByCode(service?.airport)
    if (!service || !airport) return NextResponse.json({ error: 'That ride isn’t available any more' }, { status: 404 })
    if (b.partySize > service.seats) return NextResponse.json({ error: `That vehicle seats ${service.seats}` }, { status: 400 })
    const price = fareFor(service, roadTrip(airport, { lat: b.lat, lng: b.lng }).km)
    const soonest = Date.now() + service.readyMinutes * 60000
    const pickup = b.pickupAt ? new Date(b.pickupAt) : null
    if (pickup && (pickup.getTime() < Date.now() - 600000 || pickup.getTime() > Date.now() + 365 * 86400000)) return NextResponse.json({ error: 'Pick a landing time in the next year', code: 'INVALID_BODY' }, { status: 400 })

    const result = await prisma.$transaction(async tx => {
      const booking = await tx.booking.create({
        data: {
          userId: auth.user.id,
          vendorId: service.vendor.id,
          transferServiceId: service.id,
          status: 'CONFIRMED',
          date: pickup && pickup.getTime() > soonest ? pickup : new Date(soonest),
          partySize: b.partySize,
          unitPrice: price,
          fees: 0,
          totalPrice: price,
          pickup: airport.name,
          dropoff: b.dropoff
        }
      })
      const payment = b.payWith === 'wallet'
        ? await payFromWallet(tx, { userId: auth.user.id, amount: price, description: `Transfer: ${airport.code} → ${b.dropoff}`, bookingId: booking.id, vendorId: service.vendor.id })
        : null
      const user = await tx.user.findUnique({ where: { id: auth.user.id }, select: { walletBalance: true } })
      return { booking, transactionId: payment?.id ?? null, walletBalance: user?.walletBalance ?? null }
    })
    await onBookingCreated(result.booking.id, result.transactionId)
    return NextResponse.json({ ...result, paid: Boolean(result.transactionId), vendor: service.vendor }, { status: 201 })
  } catch (error) {
    if (error instanceof WalletError) return NextResponse.json({ error: error.message, code: 'WALLET' }, { status: 402 })
    console.error('Transfer booking failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
