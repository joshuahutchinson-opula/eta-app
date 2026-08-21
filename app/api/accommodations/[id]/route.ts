import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const accommodation = await prisma.accommodation.findUnique({
      where: { id: params.id },
      include: {
        bookings: true,
        bundles: {
          include: {
            experience: true
          }
        }
      }
    })

    if (!accommodation) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    return NextResponse.json(accommodation)
  } catch (error) {
    console.error('Error fetching accommodation:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}