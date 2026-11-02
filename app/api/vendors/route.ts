import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { listParams } from '@/lib/list-params'

export const dynamic = 'force-dynamic'

// GET — marketplace vendors, filtered on the server (lib/list-params.ts):
//   ?city= | ?region=  ?category=  ?ids=  ?limit=
//   ?featured=1  B.O.N vendors with video (Home's Featured carousel)
//   ?live=1      vendors live right now
//   ?transport=1 the vetted transport providers instead (Safety)
export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = url.searchParams
  const { cities, categories, ids, limit } = listParams(request.url)
  const transport = q.get('transport') === '1'
  const where: Prisma.VendorWhereInput = {
    visibleInMarketplace: ids ? undefined : true,
    isTransport: ids ? undefined : transport,
    ...(cities ? { city: { in: cities } } : {}),
    ...(categories ? { category: { in: categories as never } } : {}),
    ...(ids ? { id: { in: ids } } : {}),
    ...(q.get('featured') === '1' ? { isPremium: true, videos: { isEmpty: false } } : {}),
    ...(q.get('live') === '1' ? { live: true } : {})
  }
  try {
    const vendors = await prisma.vendor.findMany({
      where,
      orderBy: [{ isPremium: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: {
        stories: { where: { expiresAt: { gt: new Date() }, hidden: false }, select: { id: true, content: true, type: true, imageUrl: true } },
        reviews: { where: { hidden: false }, select: { rating: true } }
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
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
