// POST { lat, lng } — share my live position with the crew (opt-in, members
// only, only while the trip is booked). POST { stop: true } stops sharing
// and forgets the last position.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { tripAccess } from '@/lib/trips'
import { lat, lng, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.union([z.object({ lat, lng }), z.object({ stop: z.literal(true) })])

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request)
    if (!access.member || access.member.userId !== auth.user.id) return NextResponse.json({ error: 'Join the crew to share your location' }, { status: 403 })
    if ('stop' in parsed.data) {
      await prisma.tripMember.update({ where: { id: access.member.id }, data: { sharingLocation: false, lat: null, lng: null, locationAt: null } })
      return NextResponse.json({ ok: true, sharing: false })
    }
    if (trip.status !== 'BOOKED') return NextResponse.json({ error: 'Location sharing starts once the trip is booked' }, { status: 409 })
    await prisma.tripMember.update({ where: { id: access.member.id }, data: { sharingLocation: true, lat: parsed.data.lat, lng: parsed.data.lng, locationAt: new Date() } })
    return NextResponse.json({ ok: true, sharing: true })
  } catch (error) {
    console.error('Error sharing location:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
