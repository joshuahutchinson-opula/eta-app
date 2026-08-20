import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const discoveries = await prisma.discovery.findMany({
      include: { vendor: true, photoSpot: true },
      orderBy: { createdAt: 'desc' }
    })
    return NextResponse.json(discoveries)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId, vendorId, photoSpotId, type } = await request.json()

    let points = 0
    if (type === 'IYKYK') points = 50
    if (type === 'PHOTO_SPOT') points = 25
    if (type === 'VENDOR') points = 10

    const discovery = await prisma.discovery.create({
      data: { userId, vendorId, photoSpotId, type, points }
    })

    await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: points } }
    })

    return NextResponse.json(discovery)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}