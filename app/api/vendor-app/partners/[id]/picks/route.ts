// /api/vendor-app/partners/:id/picks — the property's "Host's picks".
// GET → the current collection, in order.
// PUT { picks: [{ vendorId | experienceId | eventId, note? }] } → replaces
//     the collection; the array order is the display order.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePartnerAccess } from '@/lib/partner-app'
import { hostPicksFor } from '@/lib/host-picks'
import { id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const pick = z.object({ vendorId: id.optional(), experienceId: id.optional(), eventId: id.optional(), note: text(200).optional() })
  .refine(p => [p.vendorId, p.experienceId, p.eventId].filter(Boolean).length === 1, 'each pick needs exactly one of vendorId, experienceId or eventId')

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const access = await requirePartnerAccess(request, params.id)
  if (!access.ok) return access.response
  return NextResponse.json({ picks: await hostPicksFor(access.property.id) })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = await requirePartnerAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object({ picks: z.array(pick).max(30) }))
  if (!parsed.ok) return parsed.response
  const picks = parsed.data.picks
  const ids = (k: 'vendorId' | 'experienceId' | 'eventId') => picks.map(p => p[k]).filter((v): v is string => Boolean(v))
  try {
    const [vendors, experiences, events] = await Promise.all([
      prisma.vendor.count({ where: { id: { in: ids('vendorId') } } }),
      prisma.experience.count({ where: { id: { in: ids('experienceId') } } }),
      prisma.event.count({ where: { id: { in: ids('eventId') } } })
    ])
    if (vendors !== new Set(ids('vendorId')).size || experiences !== new Set(ids('experienceId')).size || events !== new Set(ids('eventId')).size) {
      return NextResponse.json({ error: 'picks: one of those doesn’t exist', code: 'INVALID_BODY' }, { status: 400 })
    }
    await prisma.$transaction([
      prisma.hostPick.deleteMany({ where: { partnerPropertyId: access.property.id } }),
      prisma.hostPick.createMany({
        data: picks.map((p, i) => ({ partnerPropertyId: access.property.id, vendorId: p.vendorId ?? null, experienceId: p.experienceId ?? null, eventId: p.eventId ?? null, note: p.note || null, sortOrder: i }))
      })
    ])
    return NextResponse.json({ picks: await hostPicksFor(access.property.id) })
  } catch (error) {
    console.error('Error saving host picks:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
