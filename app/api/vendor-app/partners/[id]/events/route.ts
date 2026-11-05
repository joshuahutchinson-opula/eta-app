// /api/vendor-app/partners/:id/events — a partner property's own events
// (beach party, live band, fish fry). They join Parties & Happenings for
// the property's town and are linked to the property, so its guests see
// them first under "At your stay".
// GET  → its upcoming and recent events.
// POST { title, description, startAt, endAt?, venueName?, imageUrl?,
//        videoUrl?, price?, isFree?, ticketUrl?, vendorId? } → a new event.
//        Venue and location default to the property; vendorId must be one
//        of its linked vendors.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePartnerAccess } from '@/lib/partner-app'
import { partnerEventSchema, partnerEventData, PartnerEventError } from '@/lib/partner-events'
import { parseBody } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requirePartnerAccess(request, params.id)
  if (!access.ok) return access.response
  const events = await prisma.event.findMany({
    where: { partnerPropertyId: access.property.id, startAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    orderBy: { startAt: 'asc' },
    include: { _count: { select: { interests: true, tickets: true } } }
  })
  return NextResponse.json(events.map(({ _count, ...e }) => ({ ...e, interestedCount: _count.interests, ticketCount: _count.tickets })))
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const access = await requirePartnerAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, partnerEventSchema)
  if (!parsed.ok) return parsed.response
  try {
    const data = await partnerEventData(access.property.id, parsed.data, true)
    const event = await prisma.event.create({ data: data as never })
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    if (error instanceof PartnerEventError) return NextResponse.json({ error: error.message, code: 'INVALID_BODY' }, { status: 400 })
    console.error('Error creating partner event:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
