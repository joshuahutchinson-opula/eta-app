import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canCollaborate, loadTrip, toTripDTO, tripAccess } from '@/lib/trips'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// POST { stopId, value: 1 | -1 } — the caller votes as their own crew member
// (worked out from their account, never from the body). Voting the same way
// twice clears the vote.
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const parsed = await parseBody(request, z.object({ stopId: id, value: z.union([z.literal(1), z.literal(-1)]), editKey: z.string().max(64).optional() }))
  if (!parsed.ok) return parsed.response
  const { stopId, value } = parsed.data
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { stops: { select: { id: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (trip.status !== 'PLANNING') return NextResponse.json({ error: 'Voting closes once the trip is booked' }, { status: 409 })
    const access = await tripAccess(trip, request, parsed.data)
    if (!canCollaborate(trip, access) || !access.member) return NextResponse.json({ error: 'Join the crew to vote' }, { status: 403 })
    if (!trip.stops.some(s => s.id === stopId)) return NextResponse.json({ error: 'Unknown stop' }, { status: 400 })
    const memberId = access.member.id

    const existing = await prisma.tripVote.findUnique({ where: { stopId_memberId: { stopId, memberId } } })
    if (existing && existing.value === value) {
      await prisma.tripVote.delete({ where: { id: existing.id } })
    } else {
      await prisma.tripVote.upsert({ where: { stopId_memberId: { stopId, memberId } }, create: { stopId, memberId, value }, update: { value } })
    }
    const full = await loadTrip(params.slug)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: access.role === 'owner' })
  } catch (error) {
    console.error('Error voting:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
