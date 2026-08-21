import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const experience = await prisma.experience.findUnique({
      where: { id: params.id },
      include: {
        vendor: true,
        moods: true,
        bookings: true
      }
    })

    if (!experience) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    return NextResponse.json(experience)
  } catch (error) {
    console.error('Error fetching experience:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}