import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const photoSpots = await prisma.photoSpot.findMany({
      orderBy: { createdAt: 'desc' }
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