// POST /api/rewards/redemptions/ETA-XXXX/redeem { vendorId } — a vendor
// scans a traveler's voucher and marks it used. For the vendor app: the
// caller must own that vendor (VENDOR role) or be an ADMIN, and the vendor
// must take part in the reward when the reward lists vendors.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canActForVendor, requireUser } from '@/lib/auth-server'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { code: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ vendorId: id }))
  if (!parsed.ok) return parsed.response
  const { vendorId } = parsed.data
  try {
    if (!(await canActForVendor(auth.user, vendorId))) return NextResponse.json({ error: 'Only the vendor or an ETA admin can do that' }, { status: 403 })
    const redemption = await prisma.redemption.findUnique({ where: { code: params.code.toUpperCase() } })
    if (!redemption) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (redemption.status === 'USED') return NextResponse.json({ error: 'This voucher was already used', usedAt: redemption.usedAt }, { status: 409 })
    if (redemption.status === 'EXPIRED' || (redemption.expiresAt && redemption.expiresAt.getTime() < Date.now())) {
      return NextResponse.json({ error: 'This voucher has expired' }, { status: 410 })
    }
    const participants = await prisma.rewardVendor.findMany({ where: { rewardId: redemption.rewardId }, select: { vendorId: true } })
    if (participants.length && !participants.some(p => p.vendorId === vendorId)) {
      return NextResponse.json({ error: 'This reward isn’t offered at this vendor' }, { status: 403 })
    }
    // Conditional on still ACTIVE, so two scans can't both succeed.
    const done = await prisma.redemption.updateMany({ where: { id: redemption.id, status: 'ACTIVE' }, data: { status: 'USED', usedAt: new Date(), vendorId } })
    if (done.count === 0) return NextResponse.json({ error: 'This voucher was already used' }, { status: 409 })
    return NextResponse.json({ ok: true, rewardName: redemption.rewardName })
  } catch (error) {
    console.error('Error redeeming voucher:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
