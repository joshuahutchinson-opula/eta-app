import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const stories = await prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() }
      },
      include: {
        vendor: {
          select: {
            name: true,
            isPremium: true,
            images: true
          }
        },
        user: {
          select: {
            name: true,
            avatarUrl: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(stories)
  } catch (error) {
    console.error('Error fetching stories:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const story = await prisma.story.create({
      data: body
    })
    return NextResponse.json(story)
  } catch (error) {
    console.error('Error creating story:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}