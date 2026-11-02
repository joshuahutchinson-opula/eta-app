import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canCollaborate, isCrew, loadTrip, recalcShares, toTripDTO, tripAccess } from '@/lib/trips'
import { id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// POST { name } — the owner adds someone to the crew by name (they can claim
// that spot later through an invite link). Invitees join via /join.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const parsed = await parseBody(request, z.object({ name: text(40).min(1, 'Add a name'), editKey: z.string().max(64).optional() }))
  if (!parsed.ok) return parsed.response
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { members: true } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request, parsed.data)
    if (access.role !== 'owner' || !canCollaborate(trip, access)) return NextResponse.json({ error: 'Only the trip owner can add people' }, { status: 403 })
    const name = parsed.data.name.trim()
    let member = trip.members.find(m => m.name.toLowerCase() === name.toLowerCase())
    if (!member) {
      if (trip.members.length >= 16) return NextResponse.json({ error: 'That crew is full' }, { status: 409 })
      member = await prisma.tripMember.create({ data: { tripId: trip.id, name } })
      await recalcShares(trip.id)
    }
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: true, memberId: member.id })
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// PATCH { memberId, status } — a member updates their own status (the owner
// can update anyone's). Payments aren't toggled here any more: each member
// pays their own share through /pay-share.
const STATUSES = ['pending', 'enroute', 'arrived'] as const

export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  const parsed = await parseBody(request, z.object({ memberId: id, status: z.enum(STATUSES), editKey: z.string().max(64).optional() }))
  if (!parsed.ok) return parsed.response
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { members: { select: { id: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request, parsed.data)
    if (!isCrew(access)) return NextResponse.json({ error: 'This trip can’t be changed' }, { status: 403 })
    if (!trip.members.some(m => m.id === parsed.data.memberId)) return NextResponse.json({ error: 'Unknown crew member' }, { status: 400 })
    if (access.role !== 'owner' && access.member?.id !== parsed.data.memberId) return NextResponse.json({ error: 'You can only update your own status' }, { status: 403 })
    await prisma.tripMember.update({ where: { id: parsed.data.memberId }, data: { status: parsed.data.status } })
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: access.role === 'owner' })
  } catch (error) {
    console.error('Error updating member:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
