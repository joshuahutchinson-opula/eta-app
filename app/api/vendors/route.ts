import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET() {
  try {
    const vendors = await prisma.vendor.findMany({
      where: {
        visibleInMarketplace: true,
        isTransport: false
      },
      orderBy: [
        { isPremium: 'desc' },
        { createdAt: 'desc' }
      ],
      include: {
        stories: {
          where: { expiresAt: { gt: new Date() } }
        }
      }
    })
    return NextResponse.json(vendors)
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}