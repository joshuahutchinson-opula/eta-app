import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const photoSpot = await prisma.photoSpot.findUnique({
      where: { id: params.id },
      include: {
        userPhotos: {
          include: {
            user: {
              select: {
                name: true,
                avatarUrl: true
              }
            }
          },
          orderBy: { likes: 'desc' }
        },
        discoveries: true
      }
    })

    if (!photoSpot) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    return NextResponse.json(photoSpot)
  } catch (error) {
    console.error('Error fetching photo spot:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}