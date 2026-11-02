import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { NO_ACCESS, loadTrip, recalcShares, toTripDTO, tripAccess } from '@/lib/trips'
import { dateOnly, id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// GET — owners and members get the full trip; an invite link gets a preview
// to join from; a view link (or a web plan) gets read-only progress.
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const trip = await loadTrip(params.slug)
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request)
    if (!access.role) return NextResponse.json({ error: NO_ACCESS, code: 'TRIP_FORBIDDEN' }, { status: 403 })
    const dto = toTripDTO(trip, access)
    if (access.role === 'invitee') {
      return NextResponse.json({ ...dto, canEdit: false, invite: { name: access.invite?.name ?? null, owner: trip.members.find(m => m.isOwner)?.name ?? null } })
    }
    return NextResponse.json({ ...dto, canEdit: access.role === 'owner' })
  } catch (error) {
    console.error('Error fetching trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// PATCH — owner edits: name, date, notes, cancelling a trip still in planning,
// advancing currentStopIndex on a booked trip ("Arrived → next stop"),
// swapStop { stopId, vendorId | photoSpotId } to change a stop mid-trip,
// experienceId to attach the picked experience to a crew trip started from
// the survey, and splitPayment.
const schema = z.object({
  editKey: z.string().max(64).optional(),
  name: text(80).optional(),
  date: z.union([dateOnly, z.string().datetime({ offset: true }), z.null()]).optional(),
  notes: text(1000).optional(),
  status: z.literal('CANCELLED').optional(),
  currentStopIndex: z.number().int().min(0).max(50).optional(),
  swapStop: z.object({ stopId: id, vendorId: id.optional(), photoSpotId: id.optional() }).optional(),
  experienceId: id.optional(),
  splitPayment: z.boolean().optional()
})

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request, body)
    if (access.role !== 'owner') return NextResponse.json({ error: 'Only the trip owner can do that' }, { status: 403 })

    const data: { name?: string; date?: Date | null; notes?: string | null; status?: 'CANCELLED'; currentStopIndex?: number; experienceId?: string; splitPayment?: boolean } = {}
    if (body.currentStopIndex !== undefined) data.currentStopIndex = body.currentStopIndex
    const swap = body.swapStop
    if (swap && (swap.vendorId || swap.photoSpotId)) {
      await prisma.tripStop.updateMany({
        where: { id: swap.stopId, tripId: trip.id },
        data: swap.vendorId ? { vendorId: swap.vendorId, photoSpotId: null, experienceId: null } : { photoSpotId: swap.photoSpotId, vendorId: null, experienceId: null }
      })
    }
    if (body.name?.trim()) data.name = body.name.trim()
    if (body.date === null) data.date = null
    else if (body.date) data.date = new Date(body.date)
    if (body.notes !== undefined) data.notes = body.notes
    if (body.status === 'CANCELLED' && trip.status === 'PLANNING') data.status = 'CANCELLED'
    if (body.splitPayment !== undefined && trip.status === 'PLANNING') data.splitPayment = body.splitPayment
    if (body.experienceId && trip.status === 'PLANNING' && body.experienceId !== trip.experienceId) {
      const exp = await prisma.experience.findUnique({ where: { id: body.experienceId }, select: { id: true } })
      if (!exp) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
      data.experienceId = exp.id
      await prisma.tripStop.deleteMany({ where: { tripId: trip.id, experienceId: { not: null } } })
      await prisma.tripStop.updateMany({ where: { tripId: trip.id }, data: { order: { increment: 1 } } })
      await prisma.tripStop.create({ data: { tripId: trip.id, experienceId: exp.id, order: 0, addedBy: access.member?.name ?? null } })
    }

    await prisma.trip.update({ where: { id: trip.id }, data })
    if (data.experienceId) await recalcShares(trip.id)
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: true })
  } catch (error) {
    console.error('Error updating trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
