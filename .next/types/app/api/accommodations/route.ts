import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const accommodations = await prisma.accommodation.findMany({
      where: { vetted: true },
      orderBy: { googleStars: 'desc' }
    })
    return NextResponse.json(accommodations)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}