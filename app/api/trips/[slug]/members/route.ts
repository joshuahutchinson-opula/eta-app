import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canCollaborate, hasEditKey, loadTrip, recalcShares, toTripDTO } from '@/lib/trips'

export const dynamic = 'force-dynamic'

const STATUSES = ['pending', 'enroute', 'arrived']

// POST { name } — a crew member joins from the shared link (or the owner adds them).
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : ''
    if (!name) return NextResponse.json({ error: 'Add a name' }, { status: 400 })
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { members: true } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (!canCollaborate(trip, request, body)) return NextResponse.json({ error: 'This trip can’t be changed' }, { status: 403 })

    let member = trip.members.find(m => m.name.toLowerCase() === name.toLowerCase())
    if (!member) {
      if (trip.members.length >= 16) return NextResponse.json({ error: 'That crew is full' }, { status: 409 })
      member = await prisma.tripMember.create({ data: { tripId: trip.id, name } })
      await recalcShares(trip.id)
    }
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!), memberId: member.id })
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// PATCH { memberId, status?, paid? } — a member updates their own status;
// marking payments is the owner's job.
export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { members: { select: { id: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (typeof body.memberId !== 'string' || !trip.members.some(m => m.id === body.memberId)) {
      return NextResponse.json({ error: 'Unknown crew member' }, { status: 400 })
    }
    const isOwner = hasEditKey(trip, request, body)
    if (!isOwner && !canCollaborate(trip, request, body)) return NextResponse.json({ error: 'This trip can’t be changed' }, { status: 403 })
    const data: { status?: string; paid?: boolean } = {}
    if (typeof body.status === 'string' && STATUSES.includes(body.status)) data.status = body.status
    if (typeof body.paid === 'boolean') {
      if (!isOwner) return NextResponse.json({ error: 'Only the trip owner can mark payments' }, { status: 403 })
      data.paid = body.paid
    }
    await prisma.tripMember.update({ where: { id: body.memberId }, data })
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!), canEdit: isOwner })
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
