import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: {
        stories: {
          where: {
            expiresAt: { gt: new Date() }
          }
        },
        reviews: {
          include: {
            user: {
              select: {
                name: true,
                avatarUrl: true
              }
            }
          }
        },
        experiences: true,
        flashDeals: {
          where: {
            expires: { gt: new Date() }
          }
        }
      }
    })

    if (!vendor) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    const reviewCount = vendor.reviews.length
    const rating = reviewCount > 0
      ? Math.round((vendor.reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount) * 10) / 10
      : undefined

    return NextResponse.json({ ...vendor, rating, reviewCount: reviewCount > 0 ? reviewCount : undefined })
  } catch (error) {
    console.error('Error fetching vendor:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: body
    })
    return NextResponse.json(vendor)
  } catch (error) {
    console.error('Error updating vendor:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.vendor.delete({
      where: { id: params.id }
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting vendor:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}