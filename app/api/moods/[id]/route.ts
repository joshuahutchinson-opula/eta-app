import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EXPERIENCE_STOPS_INCLUDE, hostVendor, stopViews } from '@/lib/experience-stops'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const mood = await prisma.mood.findUnique({
      where: { id: params.id },
      include: {
        experiences: { include: EXPERIENCE_STOPS_INCLUDE },
        media: true
      }
    })

    if (!mood) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      ...mood,
      experiences: mood.experiences.map(({ stops, ...e }) => {
        const host = hostVendor(stops)
        return { ...e, vendor: host ? { name: host.name, isPremium: host.isPremium } : null, stops: stopViews(stops) }
      })
    })
  } catch (error) {
    console.error('Error fetching mood:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}