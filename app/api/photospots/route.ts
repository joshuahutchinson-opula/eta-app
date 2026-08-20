import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const photoSpots = await prisma.photoSpot.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(photoSpots)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}