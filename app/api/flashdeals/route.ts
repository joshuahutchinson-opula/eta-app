import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const flashDeals = await prisma.flashDeal.findMany({
      where: {
        expires: { gt: new Date() }
      },
      include: {
        vendor: {
          select: {
            name: true,
            isPremium: true,
            images: true
          }
        }
      },
      orderBy: { expires: 'asc' }
    })

    return NextResponse.json(flashDeals)
  } catch (error) {
    console.error('Error fetching flash deals:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}