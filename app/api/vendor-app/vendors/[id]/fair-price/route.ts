// PUT /api/vendor-app/vendors/:id/fair-price { fairPrice } — the vendor
// confirms (or withdraws) "Fair price, same as locals". Shown as a badge on
// their cards and page while it's on.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object({ fairPrice: z.boolean() }))
  if (!parsed.ok) return parsed.response
  try {
    const vendor = await prisma.vendor.update({
      where: { id: access.vendor.id },
      data: { fairPrice: parsed.data.fairPrice, fairPriceConfirmedAt: parsed.data.fairPrice ? new Date() : null },
      select: { id: true, fairPrice: true, fairPriceConfirmedAt: true }
    })
    return NextResponse.json(vendor)
  } catch (error) {
    console.error('Error setting fair price:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
