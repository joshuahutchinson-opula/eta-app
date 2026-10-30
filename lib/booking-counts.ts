// lib/booking-counts.ts — real "booked today" counts, replacing the old
// made-up social proof. Days are Jamaica days.
import { prisma } from '@/lib/prisma'

export function startOfJamaicaDay(): Date {
  const local = new Date(Date.now() - 5 * 3600000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 5))
}

/** experienceId → bookings made today (cancelled ones excluded). Experiences with none are absent. */
export async function bookedTodayByExperience(): Promise<Map<string, number>> {
  const rows = await prisma.booking.groupBy({
    by: ['experienceId'],
    where: { experienceId: { not: null }, status: { not: 'CANCELLED' }, createdAt: { gte: startOfJamaicaDay() } },
    _count: { _all: true }
  })
  return new Map(rows.filter(r => r.experienceId).map(r => [r.experienceId as string, r._count._all]))
}
