import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const moodMedia = await prisma.moodMedia.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        mood: true
      }
    })

    return NextResponse.json(moodMedia)
  } catch (error) {
    console.error('Error fetching mood media:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const moodMedia = await prisma.moodMedia.create({
      data: body
    })
    return NextResponse.json(moodMedia)
  } catch (error) {
    console.error('Error creating mood media:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}
