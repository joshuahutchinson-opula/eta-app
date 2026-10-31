// POST { date, time? } — move your own experience booking to another date
// and start time. Allowed while a full refund would still apply
// (lib/cancellation.ts canReschedule), and the new slot must have room for
// the whole party (lib/slots.ts). Stays and generated routes aren't
// rescheduled here.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { canReschedule, parseTier } from '@/lib/cancellation'
import { jamaicaDateTime } from '@/lib/pricing'
import { assertSlotAvailable, SlotError } from '@/lib/slots'
import { notifyUser } from '@/lib/notify'
import { dateOnly, hhmm, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

class MoveError extends Error {}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ date: dateOnly, time: hhmm.nullable().optional() }))
  if (!parsed.ok) return parsed.response
  const { date, time } = parsed.data
  try {
    const b = await prisma.booking.findUnique({ where: { id: params.id }, include: { experience: { select: { id: true, name: true, cancellationTier: true, startTimes: true } }, trip: { select: { id: true } } } })
    if (!b || b.userId !== auth.user.id) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (b.status !== 'CONFIRMED' && b.status !== 'PENDING') return NextResponse.json({ error: 'This booking can’t be moved' }, { status: 409 })
    if (!b.experience || b.accommodationId) return NextResponse.json({ error: 'Only experience bookings can be moved here' }, { status: 409 })
    if (!canReschedule(parseTier(b.experience.cancellationTier), b.date)) return NextResponse.json({ error: 'It’s too close to the start to move this booking — check the cancellation policy' }, { status: 409 })
    if (b.experience.startTimes.length && !time) return NextResponse.json({ error: 'Pick a start time' }, { status: 400 })
    const start = jamaicaDateTime(date, time ?? null)
    if (!start || start.getTime() <= Date.now()) return NextResponse.json({ error: 'Pick a time that hasn’t passed' }, { status: 400 })

    const updated = await prisma.$transaction(async tx => {
      await assertSlotAvailable(tx, b.experience!.id, date, time ?? null, b.partySize, b.id)
      const done = await tx.booking.updateMany({ where: { id: b.id, status: { in: ['CONFIRMED', 'PENDING'] } }, data: { date: start, time: time ?? null, rescheduledAt: new Date() } })
      if (!done.count) throw new MoveError('This booking can’t be moved')
      if (b.trip) await tx.trip.update({ where: { id: b.trip.id }, data: { date: start } })
      return tx.booking.findUniqueOrThrow({ where: { id: b.id } })
    })
    const when = start.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })
    // A fresh key per move, so the new time gets its own confirmation.
    await notifyUser(auth.user.id, 'bookings', `booking:${b.id}:moved:${start.getTime()}`, { title: `Moved: ${b.experience.name}`, body: `Now ${when}.`, url: '/bookings' }).catch(() => {})
    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof SlotError) return NextResponse.json({ error: error.message, code: 'SLOT_UNAVAILABLE' }, { status: 409 })
    if (error instanceof MoveError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Error rescheduling booking:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
