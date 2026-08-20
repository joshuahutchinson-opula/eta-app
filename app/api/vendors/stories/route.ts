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
        vendor: true
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