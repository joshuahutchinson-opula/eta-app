import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mood = await prisma.mood.findUnique({
      where: { id: params.id },
      include: {
        experiences: {
          include: {
            vendor: {
              select: {
                name: true,
                isPremium: true
              }
            }
          }
        },
        media: true
      }
    })

    if (!mood) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    return NextResponse.json(mood)
  } catch (error) {
    console.error('Error fetching mood:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}