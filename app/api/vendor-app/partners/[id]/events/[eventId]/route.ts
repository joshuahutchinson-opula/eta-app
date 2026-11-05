// /api/vendor-app/partners/:id/events/:eventId — edit or remove one of the
// property's own events.
// PATCH { any field from POST } → the updated event.
// DELETE → removed (only events the property posted).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePartnerAccess } from '@/lib/partner-app'
import { partnerEventSchema, partnerEventData, PartnerEventError } from '@/lib/partner-events'
import { parseBody } from '@/lib/validate'

export const dynamic = 'force-dynamic'

async function ownEvent(propertyId: string, eventId: string) {
  return prisma.event.findFirst({ where: { id: eventId, partnerPropertyId: propertyId }, select: { id: true } })
}

export async function PATCH(request: Request, { params }: { params: { id: string; eventId: string } }) {
  const access = await requirePartnerAccess(request, params.id)
  if (!access.ok) return access.response
  if (!(await ownEvent(access.property.id, params.eventId))) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  const parsed = await parseBody(request, partnerEventSchema.partial())
  if (!parsed.ok) return parsed.response
  try {
    const data = await partnerEventData(access.property.id, parsed.data, false)
    return NextResponse.json(await prisma.event.update({ where: { id: params.eventId }, data: data as never }))
  } catch (error) {
    if (error instanceof PartnerEventError) return NextResponse.json({ error: error.message, code: 'INVALID_BODY' }, { status: 400 })
    console.error('Error updating partner event:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string; eventId: string } }) {
  const access = await requirePartnerAccess(request, params.id)
  if (!access.ok) return access.response
  if (!(await ownEvent(access.property.id, params.eventId))) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  try {
    const tickets = await prisma.ticket.count({ where: { eventId: params.eventId } })
    if (tickets) return NextResponse.json({ error: 'Guests have tickets for this event — edit it instead of deleting' }, { status: 409 })
    await prisma.event.delete({ where: { id: params.eventId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting partner event:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
