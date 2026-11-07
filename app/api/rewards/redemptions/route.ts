// GET — the signed-in caller's vouchers (My Rewards), newest first, each
// with whether its QR rotates.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to see your vouchers' })
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  try {
    const rows = await prisma.redemption.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 })
    const rotating = new Set((await prisma.reward.findMany({ where: { id: { in: Array.from(new Set(rows.map(r => r.rewardId))) }, rotatingQr: true }, select: { id: true } })).map(r => r.id))
    return NextResponse.json(rows.map(r => ({ ...r, rotatingQr: rotating.has(r.rewardId) })))
  } catch (error) {
    console.error('Error fetching redemptions:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
