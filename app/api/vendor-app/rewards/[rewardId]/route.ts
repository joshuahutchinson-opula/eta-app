// /api/vendor-app/rewards/:rewardId — edit a perk the vendor created.
// PATCH { any reward field, incl. dailyCap, monthlyBudget, active } → the updated reward.
// DELETE → switches it off (vouchers already issued stay valid).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { rewardFields, vendorForReward } from '@/lib/vendor-rewards'
import { ROTATING_QR_COST } from '@/lib/earn-config'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const patchSchema = z.object(Object.fromEntries(Object.entries(rewardFields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()]))) as z.ZodType<Partial<{ [K in keyof typeof rewardFields]: z.infer<(typeof rewardFields)[K]> }>>

export async function PATCH(request: Request, { params }: { params: { rewardId: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const vendorId = await vendorForReward(auth.user, params.rewardId)
  if (!vendorId) return NextResponse.json({ error: 'Only the vendor that made this reward (or an ETA admin) can change it', code: 'FORBIDDEN' }, { status: 403 })
  const parsed = await parseBody(request, patchSchema)
  if (!parsed.ok) return parsed.response
  const d = parsed.data
  const current = await prisma.reward.findUnique({ where: { id: params.rewardId }, select: { dailyCap: true, monthlyBudget: true } })
  if ((d.dailyCap ?? current!.dailyCap) > (d.monthlyBudget ?? current!.monthlyBudget)) {
    return NextResponse.json({ error: 'The daily cap can’t be more than the monthly budget', code: 'INVALID_BODY' }, { status: 400 })
  }
  const updated = await prisma.reward.update({
    where: { id: params.rewardId },
    data: { ...d, ...(d.minTier ? { category: 'insider' } : {}), ...(d.cost !== undefined ? { rotatingQr: d.cost >= ROTATING_QR_COST } : {}) }
  })
  return NextResponse.json(updated)
}

export async function DELETE(request: Request, { params }: { params: { rewardId: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const vendorId = await vendorForReward(auth.user, params.rewardId)
  if (!vendorId) return NextResponse.json({ error: 'Only the vendor that made this reward (or an ETA admin) can change it', code: 'FORBIDDEN' }, { status: 403 })
  await prisma.reward.update({ where: { id: params.rewardId }, data: { active: false } })
  return NextResponse.json({ ok: true })
}
