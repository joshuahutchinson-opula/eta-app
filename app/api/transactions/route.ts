import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { id, parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

// GET — the signed-in caller's transactions only. Never anyone else's.
export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to see your wallet' })
  if (!auth.ok) return auth.response
  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      include: { vendor: { select: { name: true } } }
    })
    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

// POST — admin-only manual ledger entry (e.g. a goodwill credit record).
// Payments are recorded by the routes that take them (lib/wallet-pay.ts).
const schema = z.object({
  userId: id,
  amount: z.number().finite().min(0).max(100000),
  type: z.enum(['PAYMENT', 'REWARD', 'TOPUP', 'TRANSFER', 'REFUND']),
  description: text(200).optional(),
  vendorId: id.optional(),
  bookingId: id.optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { role: 'ADMIN' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const d = parsed.data
    const transaction = await prisma.transaction.create({
      data: { userId: d.userId, amount: d.amount, type: d.type, description: d.description ?? null, vendorId: d.vendorId ?? null, bookingId: d.bookingId ?? null, rail: 'Manual (admin)', status: 'COMPLETED' }
    })
    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
