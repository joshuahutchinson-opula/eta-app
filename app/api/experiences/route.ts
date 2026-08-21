import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const experiences = await prisma.experience.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: {
          select: {
            name: true,
            isPremium: true
          }
        },
        moods: true
      }
    })

    return NextResponse.json(experiences)
  } catch (error) {
    console.error('Error fetching experiences:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}