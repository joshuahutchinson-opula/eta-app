// GET — one receipt, for its owner.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in to see your receipts' }, { status: 401 })
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: params.id },
      include: {
        vendor: { select: { id: true, name: true } },
        booking: { select: { id: true, date: true, partySize: true, unitPrice: true, endDate: true, experience: { select: { name: true } }, accommodation: { select: { name: true } } } },
        user: { select: { name: true } }
      }
    })
    if (!tx || tx.userId !== userId) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return NextResponse.json(tx)
  } catch (error) {
    console.error('Error fetching receipt:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
