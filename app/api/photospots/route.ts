import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listParams } from '@/lib/list-params'

export const dynamic = 'force-dynamic'

// GET ?city= | ?region=  ?ids=  ?limit=
export async function GET(request: Request) {
  const { cities, ids, limit } = listParams(request.url)
  try {
    const photoSpots = await prisma.photoSpot.findMany({
      where: { ...(cities ? { city: { in: cities } } : {}), ...(ids ? { id: { in: ids } } : {}) },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        userPhotos: {
          where: { hidden: false },
          orderBy: { likes: 'desc' },
          take: 5
        }
      }
    })

    return NextResponse.json(photoSpots)
  } catch (error) {
    console.error('Error fetching photo spots:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}