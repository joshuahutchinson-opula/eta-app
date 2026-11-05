// PATCH /api/vendor-app/vendors/:id/explorer-perks/:rewardId { name?,
// description?, validDays?, active? } — edit or switch off one of the
// vendor's explorer-only perks. Vouchers already unlocked stay valid.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendorAccess } from '@/lib/vendor-app'
import { EXPLORER_KIND } from '@/lib/explore'
import { parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name: text(80).min(2),
  description: text(300).min(5),
  validDays: z.number().int().min(1).max(365),
  active: z.boolean()
}).partial()

export async function PATCH(request: Request, { params }: { params: { id: string; rewardId: string } }) {
  const access = await requireVendorAccess(request, params.id)
  if (!access.ok) return access.response
  const reward = await prisma.reward.findFirst({ where: { id: params.rewardId, kind: EXPLORER_KIND, vendors: { some: { vendorId: access.vendor.id } } } })
  if (!reward) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  return NextResponse.json(await prisma.reward.update({ where: { id: reward.id }, data: parsed.data }))
}
