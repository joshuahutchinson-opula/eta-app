// PUT /api/vendor-app/partners/:id/vendors { vendorIds } — the property's own
// restaurant, bar, spa and activities, listed as vendors linked to it. The
// list replaces the current links. Owners can link vendors they also own;
// ETA admins can link any. ETA's cut is the normal in-app payment cut.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePartnerAccess } from '@/lib/partner-app'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = await requirePartnerAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object({ vendorIds: z.array(id).max(50) }))
  if (!parsed.ok) return parsed.response
  const ids = Array.from(new Set(parsed.data.vendorIds))
  try {
    const vendors = await prisma.vendor.findMany({ where: { id: { in: ids } }, select: { id: true, ownerId: true } })
    if (vendors.length !== ids.length) return NextResponse.json({ error: 'vendorIds: unknown vendor', code: 'INVALID_BODY' }, { status: 400 })
    if (access.user.role !== 'ADMIN' && vendors.some(v => v.ownerId !== access.user.id)) {
      return NextResponse.json({ error: 'You can only link vendors you run', code: 'FORBIDDEN' }, { status: 403 })
    }
    await prisma.$transaction([
      prisma.vendor.updateMany({ where: { partnerPropertyId: access.property.id, id: { notIn: ids } }, data: { partnerPropertyId: null } }),
      prisma.vendor.updateMany({ where: { id: { in: ids } }, data: { partnerPropertyId: access.property.id } })
    ])
    const linked = await prisma.vendor.findMany({ where: { partnerPropertyId: access.property.id }, select: { id: true, name: true, category: true } })
    return NextResponse.json({ vendors: linked })
  } catch (error) {
    console.error('Error linking partner vendors:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
