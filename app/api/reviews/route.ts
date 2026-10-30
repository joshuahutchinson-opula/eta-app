import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const reviews = await prisma.review.findMany({
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

    return NextResponse.json(reviews)
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const review = await prisma.review.create({
      data: {
        userId: body.userId,
        vendorId: body.vendorId,
        experienceId: typeof body.experienceId === 'string' ? body.experienceId : null,
        // Whole stars, 1–5.
        rating: Math.max(1, Math.min(5, Math.round(Number(body.rating) || 0))),
        comment: typeof body.comment === 'string' ? body.comment.slice(0, 1000) : null
      }
    })
    return NextResponse.json(review)
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}