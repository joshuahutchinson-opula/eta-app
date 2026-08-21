import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { city, hour } = body

    const vendors = await prisma.vendor.findMany({
      where: {
        city: city || 'NEGRIL',
        open: true
      },
      include: {
        experiences: true
      },
      orderBy: [
        { live: 'desc' },
        { isPremium: 'desc' }
      ],
      take: 10
    })

    return NextResponse.json({ vendors })
  } catch (error) {
    console.error('Error in context engine:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}