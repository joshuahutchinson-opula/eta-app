import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const transactions = await prisma.transaction.findMany({
      include: { vendor: true, user: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
    return NextResponse.json(transactions)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId, vendorId, amount } = await request.json()
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        vendorId,
        amount,
        type: 'PAYMENT',
        status: 'COMPLETED'
      }
    })
    const pointsEarned = Math.floor(amount)
    await prisma.user.update({
      where: { id: userId },
      data: {
        points: { increment: pointsEarned },
        walletBalance: { decrement: amount }
      }
    })
    return NextResponse.json({ transaction, pointsEarned })
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}