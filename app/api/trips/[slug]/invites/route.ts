// POST { name? } — make an invite link for this trip (owner or any member).
// Whoever opens it signs in and joins the crew with their own account; a
// name fills in (or claims) their spot in the crew.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canCollaborate, newToken, tripAccess } from '@/lib/trips'
import { absoluteUrl } from '@/lib/site-url'
import { parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const parsed = await parseBody(request, z.object({ name: text(40).optional(), editKey: z.string().max(64).optional() }))
  if (!parsed.ok) return parsed.response
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request, parsed.data)
    if (!canCollaborate(trip, access) || trip.source !== 'app') return NextResponse.json({ error: 'Only the crew can invite people' }, { status: 403 })
    const invite = await prisma.tripInvite.create({ data: { tripId: trip.id, token: newToken(), name: parsed.data.name?.trim() || null } })
    return NextResponse.json({ token: invite.token, url: absoluteUrl(`/trip/${trip.slug}?invite=${invite.token}`) }, { status: 201 })
  } catch (error) {
    console.error('Error creating invite:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
