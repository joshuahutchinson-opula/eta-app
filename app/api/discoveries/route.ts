import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const discoveries = await prisma.discovery.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true
          }
        },
        vendor: true,
        photoSpot: true
      }
    })

    return NextResponse.json(discoveries)
  } catch (error) {
    console.error('Error fetching discoveries:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const discovery = await prisma.discovery.create({
      data: body
    })
    return NextResponse.json(discovery)
  } catch (error) {
    console.error('Error creating discovery:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}