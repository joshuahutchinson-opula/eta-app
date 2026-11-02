// app/api/reservations/route.ts — reservation requests to vendors.
// GET  → the caller's requests (with status: REQUESTED = pending,
//        CONFIRMED = accepted, DECLINED).
// POST { vendorId, date, time, partySize, note? } (signed in, verified).
// The vendor answers through PATCH /api/reservations/[id] (vendor app).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { jamaicaDateTime } from '@/lib/pricing'
import { dateOnly, hhmm, id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to see your reservations' })
  if (!auth.ok) return auth.response
  try {
    const rows = await prisma.reservationRequest.findMany({
      where: { userId: auth.user.id },
      orderBy: { date: 'asc' },
      include: { vendor: { select: { id: true, name: true, images: true, neighborhood: true, lat: true, lng: true } } }
    })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({
  vendorId: id,
  date: dateOnly,
  time: hhmm,
  partySize: z.number().int().min(1).max(30).default(2),
  note: text(280).optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { verified: true, message: 'Log in to request a reservation' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return NextResponse.json({ error: 'Pick a date and time' }, { status: 400 })
  const { vendorId, time, partySize, note } = parsed.data
  const date = jamaicaDateTime(parsed.data.date, time)
  if (!date || date.getTime() < Date.now()) return NextResponse.json({ error: 'Pick a time that hasn’t passed' }, { status: 400 })
  try {
    const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { acceptsReservations: true } })
    if (!vendor) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!vendor.acceptsReservations) return NextResponse.json({ error: 'This spot doesn’t take reservations' }, { status: 409 })
    const row = await prisma.reservationRequest.create({ data: { vendorId, userId: auth.user.id, date, time, partySize, note: note || null } })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
