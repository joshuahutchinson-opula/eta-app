import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { userId, vendorId, rating, comment } = await request.json()
    const review = await prisma.review.create({
      data: { userId, vendorId, rating, comment }
    })
    return NextResponse.json(review)
  } catch (error) {
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}