import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EXPERIENCE_STOPS_INCLUDE, hostVendor, routeMinutes, routeRatings, stopViews } from '@/lib/experience-stops'
import { startOfJamaicaDay } from '@/lib/booking-counts'

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
        reviews: {
          where: { hidden: false },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, avatarUrl: true } } }
        }
      }
    })

    if (!experience) {
      return NextResponse.json(
        { error: 'Nuttin nuh go suh' },
        { status: 404 }
      )
    }

    const bookedToday = await prisma.booking.count({
      where: { experienceId: experience.id, status: { not: 'CANCELLED' }, createdAt: { gte: startOfJamaicaDay() } }
    })

    const { stops, reviews, ...rest } = experience
    const host = hostVendor(stops)
    const hostRatings = host?.reviews.map(r => r.rating) ?? []
    const ownRatings = reviews.map(r => r.rating)
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)
    return NextResponse.json({
      ...rest,
      vendor: host ? { id: host.id, name: host.name, image: host.images[0] ?? null, neighborhood: host.neighborhood, isPremium: host.isPremium, rating: avg(hostRatings), reviewCount: hostRatings.length } : null,
      stops: stopViews(stops),
      totalMinutes: routeMinutes(stops),
      // The latest few inline; /experiences/[id]/reviews lists them all.
      reviews: reviews.slice(0, 3).map(r => ({ id: r.id, rating: r.rating, comment: r.comment, createdAt: r.createdAt, user: { name: r.user.name.split(' ')[0], avatarUrl: r.user.avatarUrl } })),
      reviewCount: reviews.length,
      // The experience's own reviews when it has them; otherwise its route vendors' ratings.
      rating: avg(ownRatings.length ? ownRatings : routeRatings(stops)),
      bookedToday
    })
  } catch (error) {
    console.error('Error fetching experience:', error)
    return NextResponse.json(
      { error: 'Sumth nah wuk' },
      { status: 500 }
    )
  }
}
