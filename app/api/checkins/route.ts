import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const checkIns = await prisma.checkIn.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            name: true,
            avatarUrl: true
          }
        },
        vendor: {
          select: {
            name: true
          }
        }
      }
    })

    return NextResponse.json(checkIns)
  } catch (error) {
    console.error('Error fetching check-ins:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const checkIn = await prisma.checkIn.create({
      data: body
    })
    return NextResponse.json(checkIn)
  } catch (error) {
    console.error('Error creating check-in:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}