import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { jamaicaDateTime, priceBreakdown } from '@/lib/pricing'
import { dateOnly, hhmm, id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// GET — the signed-in caller's bookings only, with what My Bookings needs:
// the trip behind it and its receipts.
export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to see your bookings' })
  if (!auth.ok) return auth.response
  try {
    const bookings = await prisma.booking.findMany({
      where: { userId: auth.user.id },
      orderBy: { date: 'asc' },
      include: {
        experience: { select: { id: true, name: true, imageUrl: true, meetingPoint: true, meetingLat: true, meetingLng: true, city: true, cancellationTier: true, startTimes: true, capacityPerSlot: true, maxPartySize: true } },
        vendor: { select: { id: true, name: true, images: true, neighborhood: true, lat: true, lng: true } },
        accommodation: { select: { id: true, name: true, media: true, city: true, lat: true, lng: true } },
        trip: { select: { slug: true, status: true, name: true } },
        transactions: { select: { id: true, amount: true, status: true, type: true, createdAt: true }, orderBy: { createdAt: 'asc' } }
      }
    })
    return NextResponse.json(bookings)
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// POST { experienceId | vendorId, date, time?, partySize } — a PENDING booking
// request priced on the server. Paid bookings go through the trip and stay
// booking flows; nothing here can mark a booking paid or completed.
const createSchema = z.object({
  experienceId: id.optional(),
  vendorId: id.optional(),
  date: dateOnly,
  time: hhmm.optional(),
  partySize: z.number().int().min(1).max(30).default(1)
}).refine(b => Boolean(b.experienceId) !== Boolean(b.vendorId), 'Pick one experience or vendor')

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to book' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, createSchema)
  if (!parsed.ok) return parsed.response
  const b = parsed.data
  const date = jamaicaDateTime(b.date, b.time)
  if (!date || date.getTime() < Date.now()) return NextResponse.json({ error: 'Pick a time that hasn’t passed' }, { status: 400 })
  try {
    const exp = b.experienceId ? await prisma.experience.findUnique({ where: { id: b.experienceId }, select: { price: true } }) : null
    if (b.experienceId && !exp) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (b.vendorId && !(await prisma.vendor.findUnique({ where: { id: b.vendorId }, select: { id: true } }))) {
      return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    }
    const price = priceBreakdown(exp?.price ?? 0, b.partySize)
    const booking = await prisma.booking.create({
      data: {
        userId: auth.user.id,
        experienceId: b.experienceId ?? null,
        vendorId: b.vendorId ?? null,
        date,
        time: b.time ?? null,
        partySize: b.partySize,
        unitPrice: exp?.price ?? null,
        fees: price.fees,
        totalPrice: price.total,
        pointsEarned: Math.floor(price.subtotal),
        status: 'PENDING'
      }
    })
    return NextResponse.json(booking, { status: 201 })
  } catch (error) {
    console.error('Error creating booking:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
