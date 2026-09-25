import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EXPERIENCE_STOPS_INCLUDE, hostVendor, routeMinutes, stopViews } from '@/lib/experience-stops'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const experience = await prisma.experience.findUnique({
      where: { id: params.id },
      include: {
        ...EXPERIENCE_STOPS_INCLUDE,
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

    const { stops, ...rest } = experience
    return NextResponse.json({ ...rest, vendor: hostVendor(stops), stops: stopViews(stops), totalMinutes: routeMinutes(stops) })
  } catch (error) {
    console.error('Error fetching experience:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}