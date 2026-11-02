import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listParams } from '@/lib/list-params'

export const dynamic = 'force-dynamic'

// GET ?city= | ?region=  ?ids=  ?limit=
export async function GET(request: Request) {
  const { cities, ids, limit } = listParams(request.url)
  try {
    const accommodations = await prisma.accommodation.findMany({
      where: { ...(cities ? { city: { in: cities } } : {}), ...(ids ? { id: { in: ids } } : {}) },
      take: limit,
      orderBy: [
        { vetted: 'desc' },
        { googleStars: 'desc' }
      ],
      include: {
        bundles: true
      }
    })

    return NextResponse.json(accommodations)
  } catch (error) {
    console.error('Error fetching accommodations:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}