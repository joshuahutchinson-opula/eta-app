import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EXPERIENCE_STOPS_INCLUDE, hostVendor, routeMinutes, routeRatings, stopViews } from '@/lib/experience-stops'
import { bookedTodayByExperience } from '@/lib/booking-counts'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [experiences, bookedToday] = await Promise.all([
      prisma.experience.findMany({
        orderBy: { createdAt: 'desc' },
        include: { ...EXPERIENCE_STOPS_INCLUDE, moods: true, reviews: { select: { rating: true } } }
      }),
      bookedTodayByExperience()
    ])

    return NextResponse.json(experiences.map(({ stops, reviews, ...e }) => {
      const host = hostVendor(stops)
      const ratings = reviews.length ? reviews.map(r => r.rating) : routeRatings(stops)
      const minutes = routeMinutes(stops)
      return {
        ...e,
        vendor: host ? { id: host.id, name: host.name, isPremium: host.isPremium } : null,
        stops: stopViews(stops),
        // Hours, rounded to the half hour — what the Home cards show. Null without a route.
        totalDuration: minutes > 0 ? Math.round(minutes / 30) / 2 : null,
        rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : undefined,
        reviewCount: ratings.length || undefined,
        // Real bookings made today; 0 means show nothing.
        bookedToday: bookedToday.get(e.id) ?? 0
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
