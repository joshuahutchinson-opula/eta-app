import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canCollaborate, cleanStopInput, loadTrip, nextStopOrder, toTripDTO, tripAccess } from '@/lib/trips'
import { id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// POST — add a stop (the "Add to trip" quick action, or a crew suggestion).
// Owners and members only; the "added by" name is the caller's crew name.
const addSchema = z.object({
  vendorId: id.optional(),
  experienceId: id.optional(),
  photoSpotId: id.optional(),
  time: text(20).optional(),
  note: text(280).optional(),
  editKey: z.string().max(64).optional()
})

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const parsed = await parseBody(request, addSchema)
  if (!parsed.ok) return parsed.response
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request, parsed.data)
    if (!canCollaborate(trip, access)) return NextResponse.json({ error: 'This trip can’t be changed' }, { status: 403 })
    const input = cleanStopInput(parsed.data)
    if (!input) return NextResponse.json({ error: 'Pick one vendor, experience or photo spot' }, { status: 400 })

    const duplicate = await prisma.tripStop.findFirst({
      where: { tripId: trip.id, vendorId: input.vendorId ?? undefined, experienceId: input.experienceId ?? undefined, photoSpotId: input.photoSpotId ?? undefined }
    })
    if (!duplicate) {
      await prisma.tripStop.create({ data: { ...input, tripId: trip.id, order: await nextStopOrder(trip.id), addedBy: access.member?.name ?? null } })
      await prisma.trip.update({ where: { id: trip.id }, data: { updatedAt: new Date() } })
    }
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: access.role === 'owner', alreadyAdded: Boolean(duplicate) })
  } catch (error) {
    console.error('Error adding stop:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// PATCH { order: [stopId, ...] } or { stopId, time, note } — owner only.
const patchSchema = z.object({
  order: z.array(id).max(50).optional(),
  stopId: id.optional(),
  time: text(20).optional(),
  note: text(280).optional(),
  editKey: z.string().max(64).optional()
})

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const parsed = await parseBody(request, patchSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { stops: { select: { id: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request, body)
    if (access.role !== 'owner') return NextResponse.json({ error: 'Only the trip owner can do that' }, { status: 403 })
    const ids = new Set(trip.stops.map(s => s.id))

    if (body.order) {
      const order = body.order.filter(stopId => ids.has(stopId))
      await prisma.$transaction(order.map((stopId, i) => prisma.tripStop.update({ where: { id: stopId }, data: { order: i } })))
    } else if (body.stopId && ids.has(body.stopId)) {
      await prisma.tripStop.update({
        where: { id: body.stopId },
        data: {
          ...(body.time !== undefined ? { time: body.time || null } : {}),
          ...(body.note !== undefined ? { note: body.note || null } : {})
        }
      })
    }
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: true })
  } catch (error) {
    console.error('Error updating stops:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// DELETE ?stopId= — owner only.
export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  try {
    const stopId = new URL(request.url).searchParams.get('stopId')
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request)
    if (access.role !== 'owner') return NextResponse.json({ error: 'Only the trip owner can do that' }, { status: 403 })
    if (trip.status !== 'PLANNING') return NextResponse.json({ error: 'Booked trips can’t lose stops' }, { status: 409 })
    if (stopId) await prisma.tripStop.deleteMany({ where: { id: stopId, tripId: trip.id } })
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: true })
  } catch (error) {
    console.error('Error removing stop:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
