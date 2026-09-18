import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const moments = await prisma.userMoment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true
          }
        },
        photoSpot: true
      }
    })

    return NextResponse.json(moments)
  } catch (error) {
    console.error('Error fetching moments:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const moment = await prisma.userMoment.create({
      data: body
    })
    return NextResponse.json(moment)
  } catch (error) {
    console.error('Error creating moment:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}
