// GET — the live QR value for one of the caller's vouchers. Rotating-QR
// rewards change every 30 s ("<code>.<token>", lib/vouchers.ts); others
// are just the code. { value, refreshAt (ms epoch) | null }.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { voucherQrValue } from '@/lib/vouchers'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const code = params.code.toUpperCase()
  const r = await prisma.redemption.findUnique({ where: { code }, select: { userId: true, rewardId: true, status: true } })
  if (!r || r.userId !== auth.user.id) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  const reward = await prisma.reward.findUnique({ where: { id: r.rewardId }, select: { rotatingQr: true } })
  if (!reward?.rotatingQr || r.status !== 'ACTIVE') return NextResponse.json({ value: code, refreshAt: null })
  return NextResponse.json(voucherQrValue(code))
}
