import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const spot = await prisma.photoSpot.findUnique({
      where: { id: params.id },
      include: {
        userPhotos: {
          include: {
            user: { select: { name: true } }
          }
        }
      }
    })
    if (!spot) {
      return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    }
    const formattedSpot = {
      ...spot,
      userPhotos: spot.userPhotos.map(photo => ({
        id: photo.id,
        url: photo.url,
        caption: photo.caption,
        likes: photo.likes,
        uploadedBy: photo.user.name
      }))
    }
    return NextResponse.json(formattedSpot)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}