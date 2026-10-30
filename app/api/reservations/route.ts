// app/api/reservations/route.ts — reservation requests to vendors.
// GET  → the caller's requests.  POST { vendorId, date, time, partySize, note? } (signed in).
// The vendor confirms or declines on their side; until then it's REQUESTED.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { jamaicaDateTime } from '@/lib/pricing'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json([])
  try {
    const rows = await prisma.reservationRequest.findMany({ where: { userId }, orderBy: { date: 'asc' }, include: { vendor: { select: { id: true, name: true } } } })
    return NextResponse.json(rows)
  } catch (error) {
    console.error('Error fetching reservations:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in to request a reservation' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const date = typeof body.date === 'string' ? jamaicaDateTime(body.date, body.time) : null
  if (typeof body.vendorId !== 'string' || !date || typeof body.time !== 'string') {
    return NextResponse.json({ error: 'Pick a date and time' }, { status: 400 })
  }
  try {
    const row = await prisma.reservationRequest.create({
      data: {
        vendorId: body.vendorId,
        userId,
        date,
        time: body.time,
        partySize: Math.max(1, Math.min(30, Math.round(Number(body.partySize) || 2))),
        note: typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 280) : null
      }
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    console.error('Error creating reservation:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
