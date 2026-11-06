// POST { vendorId?, amount, tip?, rail } (signed in) — Scan & Pay: pays a
// vendor (from their scanned QR) with an optional tip, records it as a
// transaction (the receipt) and credits the points the checkout promised
// (1 per dollar, tip excluded). rail "ETA Wallet" takes it from the wallet
// balance; the other rails (JAM-DEX / Lynk / Stripe) aren't wired yet, so
// for those this records the choice.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { payFromWallet, WalletError } from '@/lib/wallet-pay'
import { sendReceipt } from '@/lib/booking-notify'
import { id, parseBody, z } from '@/lib/validate'
import { promptReview } from '@/lib/review-prompts'

export const dynamic = 'force-dynamic'

const WALLET_RAIL = 'ETA Wallet'

const schema = z.object({
  vendorId: id.nullable().optional(),
  amount: z.number().finite().positive().max(100000),
  tip: z.number().finite().min(0).max(100000).default(0),
  rail: z.string().trim().max(40).default('Auto')
})

const cents = (n: number) => Math.round(n * 100) / 100

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to pay' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const userId = auth.user.id
  const amount = cents(parsed.data.amount)
  const tip = cents(parsed.data.tip)
  const total = cents(amount + tip)
  try {
    const vendor = parsed.data.vendorId ? await prisma.vendor.findUnique({ where: { id: parsed.data.vendorId }, select: { id: true, name: true } }) : null
    if (parsed.data.vendorId && !vendor) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const description = vendor?.name ?? 'ETA Pay'
    const tx = await prisma.$transaction(async db => {
      const row = parsed.data.rail === WALLET_RAIL
        ? await payFromWallet(db, { userId, amount: total, tip, description, vendorId: vendor?.id ?? null })
        : await db.transaction.create({ data: { userId, vendorId: vendor?.id ?? null, amount: total, tip, rail: parsed.data.rail, description, type: 'PAYMENT', status: 'COMPLETED' } })
      await db.user.update({ where: { id: userId }, data: { points: { increment: Math.floor(amount) } } })
      return row
    })
    sendReceipt(tx.id).catch(err => console.error('Receipt failed:', err))
    if (vendor) await promptReview(userId, vendor.id, 'payment', tx.id).catch(err => console.error('Review prompt failed:', err))
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true, walletBalance: true } })
    return NextResponse.json({ transactionId: tx.id, points: user?.points ?? null, walletBalance: user?.walletBalance ?? null }, { status: 201 })
  } catch (error) {
    if (error instanceof WalletError) return NextResponse.json({ error: error.message, code: 'WALLET' }, { status: 402 })
    console.error('Payment failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
