// POST { invite, name? } — a signed-in user opens an invite link and joins
// the crew. If the invite (or the name they give) matches a spot the owner
// typed in without an account, they take over that spot.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { loadTrip, recalcShares, toTripDTO, tripAccess } from '@/lib/trips'
import { notifyUser } from '@/lib/notify'
import { parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireUser(request, { message: 'Log in to join this trip' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ invite: z.string().min(8).max(64), name: text(40).optional() }))
  if (!parsed.ok) return parsed.response
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { members: true } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (trip.status === 'CANCELLED' || trip.status === 'COMPLETED') return NextResponse.json({ error: 'This trip is over' }, { status: 409 })
    const invite = await prisma.tripInvite.findFirst({ where: { tripId: trip.id, token: parsed.data.invite } })
    if (!invite) return NextResponse.json({ error: 'This invite link doesn’t work anymore — ask for a new one' }, { status: 403 })

    let member = trip.members.find(m => m.userId === auth.user.id)
    if (!member) {
      const wanted = (parsed.data.name?.trim() || invite.name || auth.user.name.split(' ')[0]).slice(0, 40)
      const spot = trip.members.find(m => !m.userId && !m.isOwner && m.name.toLowerCase() === wanted.toLowerCase())
      if (spot) {
        member = await prisma.tripMember.update({ where: { id: spot.id }, data: { userId: auth.user.id } })
      } else {
        if (trip.members.length >= 16) return NextResponse.json({ error: 'That crew is full' }, { status: 409 })
        member = await prisma.tripMember.create({ data: { tripId: trip.id, name: wanted, userId: auth.user.id } })
        await recalcShares(trip.id)
      }
      await prisma.tripInvite.update({ where: { id: invite.id }, data: { acceptedAt: invite.acceptedAt ?? new Date(), memberId: invite.memberId ?? member.id } })
      if (trip.ownerId) {
        await notifyUser(trip.ownerId, 'crew', `trip:${trip.id}:joined:${member.id}`, { title: `${member.name} joined ${trip.name}`, body: 'They can vote on stops and see the plan.', url: `/trip/${trip.slug}` }).catch(() => {})
      }
    }
    const full = await loadTrip(params.slug)
    const access = await tripAccess(full!, request)
    return NextResponse.json({ ...toTripDTO(full!, access), canEdit: access.role === 'owner', memberId: member.id })
  } catch (error) {
    console.error('Error joining trip:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
