import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { listParams } from '@/lib/list-params'

export const dynamic = 'force-dynamic'

// GET ?city= | ?region=  ?ids=  ?limit= — stay listings (book direct with the
// property). ETA Partner properties come first and carry `partner`.
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
        bundles: true,
        partner: { select: { code: true, name: true, active: true } }
      }
    })
    const shaped = accommodations.map(({ partner, ...a }) => ({ ...a, partner: partner?.active ? { code: partner.code, name: partner.name } : null }))
    return NextResponse.json([...shaped.filter(a => a.partner), ...shaped.filter(a => !a.partner)])
  } catch (error) {
    console.error('Error fetching accommodations:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}
