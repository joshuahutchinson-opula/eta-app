import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const deals = await prisma.flashDeal.findMany({
      where: { expires: { gt: new Date() } },
      include: { vendor: true },
      orderBy: { expires: 'asc' }
    })
    return NextResponse.json(deals)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}