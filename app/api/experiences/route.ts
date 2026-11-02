import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { EXPERIENCE_STOPS_INCLUDE, hostVendor, routeMinutes, routeRatings, stopViews } from '@/lib/experience-stops'
import { bookedTodayByExperience } from '@/lib/booking-counts'
import { listParams } from '@/lib/list-params'

export const dynamic = 'force-dynamic'

// GET ?city= | ?region=  ?mood=<moodId>  ?ids=  ?limit=
export async function GET(request: Request) {
  const { cities, ids, limit } = listParams(request.url)
  const mood = new URL(request.url).searchParams.get('mood')
  const where: Prisma.ExperienceWhereInput = {
    ...(cities ? { city: { in: cities } } : {}),
    ...(ids ? { id: { in: ids } } : {}),
    ...(mood ? { moods: { some: { id: mood } } } : {})
  }
  try {
    const [experiences, bookedToday] = await Promise.all([
      prisma.experience.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { ...EXPERIENCE_STOPS_INCLUDE, moods: true, reviews: { where: { hidden: false }, select: { rating: true } } }
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
        totalMinutes: minutes > 0 ? minutes : null,
        rating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : undefined,
        reviewCount: ratings.length || undefined,
        // Real bookings made today; 0 means show nothing.
        bookedToday: bookedToday.get(e.id) ?? 0
      }
    }))
  } catch (error) {
    console.error('Error fetching experiences:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
