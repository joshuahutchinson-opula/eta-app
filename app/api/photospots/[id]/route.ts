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
          where: { hidden: false },
          include: {
            user: {
              select: {
                name: true,
                avatarUrl: true
              }
            }
          },
          orderBy: { likes: 'desc' }
        }
      }
    })

    if (!photoSpot) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    return NextResponse.json({ ...photoSpot, userPhotos: photoSpot.userPhotos.map(p => ({ ...p, user: { name: p.user.name.split(' ')[0], avatarUrl: p.user.avatarUrl } })) })
  } catch (error) {
    console.error('Error fetching photo spot:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}