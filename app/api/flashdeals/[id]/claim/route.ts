// POST — claim a flash deal (signed in). One claim per person per deal;
// claiming again returns the same voucher code.
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { message: 'Log in to claim this deal' })
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  try {
    const deal = await prisma.flashDeal.findUnique({ where: { id: params.id }, include: { vendor: { select: { name: true } } } })
    if (!deal) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (deal.expires.getTime() <= Date.now()) return NextResponse.json({ error: 'This deal has ended' }, { status: 410 })
    const existing = await prisma.flashDealClaim.findUnique({ where: { dealId_userId: { dealId: deal.id, userId } } })
    const claim = existing ?? await prisma.flashDealClaim.create({
      data: { dealId: deal.id, userId, code: `DEAL-${crypto.randomBytes(3).toString('hex').toUpperCase()}` }
    })
    return NextResponse.json({ code: claim.code, deal: deal.deal, vendor: deal.vendor.name, expires: deal.expires, alreadyClaimed: Boolean(existing) })
  } catch (error) {
    console.error('Error claiming deal:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
