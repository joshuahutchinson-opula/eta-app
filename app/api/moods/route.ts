import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const moods = await prisma.mood.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        // Screens only need which experiences a mood covers, not the whole records.
        experiences: { select: { id: true, city: true } },
        media: { where: { hidden: false }, take: 6, orderBy: { createdAt: 'desc' } }
      }
    })

    return NextResponse.json(moods)
  } catch (error) {
    console.error('Error fetching moods:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}