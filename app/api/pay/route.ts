// POST { amount, tip, rail, vendorCode? } (signed in) — records a Pay-tab
// payment with its tip as a transaction (the receipt) and credits the points
// the checkout promised (1 per dollar, tip excluded). The rails themselves
// (JAM-DEX / Lynk / Stripe) aren't wired yet; this just records the choice.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in to pay' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const amount = Math.round(Number(body.amount) * 100) / 100
  const tip = Math.max(0, Math.round(Number(body.tip || 0) * 100) / 100)
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Enter an amount' }, { status: 400 })
  const vendorId = typeof body.vendorId === 'string' ? body.vendorId : null

  try {
    const vendor = vendorId ? await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, name: true } }) : null
    const tx = await prisma.$transaction(async db => {
      const row = await db.transaction.create({
        data: {
          userId,
          vendorId: vendor?.id ?? null,
          amount: Math.round((amount + tip) * 100) / 100,
          tip,
          rail: typeof body.rail === 'string' ? body.rail.slice(0, 30) : null,
          description: vendor?.name ?? (typeof body.vendorCode === 'string' && body.vendorCode.trim() ? `Vendor ${body.vendorCode.trim().slice(0, 20)}` : 'ETA Pay'),
          type: 'PAYMENT',
          status: 'COMPLETED'
        }
      })
      await db.user.update({ where: { id: userId }, data: { points: { increment: Math.floor(amount) } } })
      return row
    })
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true } })
    return NextResponse.json({ transactionId: tx.id, points: user?.points ?? null }, { status: 201 })
  } catch (error) {
    console.error('Payment failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
