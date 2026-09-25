import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EXPERIENCE_STOPS_INCLUDE, hostVendor, routeMinutes, stopViews } from '@/lib/experience-stops'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const experiences = await prisma.experience.findMany({
      orderBy: { createdAt: 'desc' },
      include: { ...EXPERIENCE_STOPS_INCLUDE, moods: true }
    })

    return NextResponse.json(experiences.map(({ stops, ...e }) => {
      const host = hostVendor(stops)
      return {
        ...e,
        vendor: host ? { name: host.name, isPremium: host.isPremium } : null,
        stops: stopViews(stops),
        // Hours, rounded to the half hour — what the Home cards show.
        totalDuration: Math.round(routeMinutes(stops) / 30) / 2
      }
    }))
  } catch (error) {
    console.error('Error fetching experiences:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}
