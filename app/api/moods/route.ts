import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const moods = await prisma.mood.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        experiences: true,
        media: true
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