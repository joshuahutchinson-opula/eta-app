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
          where: {
            expiresAt: { gt: new Date() }
          }
        },
        reviews: {
          select: { rating: true }
        }
      }
    })

    const withRatings = vendors.map(({ reviews, ...vendor }) => {
      const reviewCount = reviews.length
      const rating = reviewCount > 0
        ? Math.round((reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / reviewCount) * 10) / 10
        : undefined
      return { ...vendor, rating, reviewCount: reviewCount > 0 ? reviewCount : undefined }
    })

    return NextResponse.json(withRatings)
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}