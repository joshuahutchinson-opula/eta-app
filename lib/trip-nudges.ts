// lib/trip-nudges.ts — scheduled trip messages, run from /api/cron/reminders:
//   • Plan B: rain forecast for a booked outdoor experience → offer the swap.
//   • Home: a couple of days after the trip ends, "planning your next trip?"
//     with the points they still have (points never expire).
// Each has a unique notification key, so re-running never double-sends.
import { prisma } from '@/lib/prisma'
import { notifyUser } from '@/lib/notify'
import { planBOffers, PLAN_B_LOOKAHEAD_MS } from '@/lib/plan-b'

const DAY = 86400000
/** How long after the last trip day we assume they've flown home. */
export const HOME_NUDGE_AFTER_MS = 2 * DAY

export async function runPlanBAlerts(now = new Date()): Promise<number> {
  const users = await prisma.booking.findMany({
    where: { status: 'CONFIRMED', experienceId: { not: null }, accommodationId: null, date: { gt: now, lte: new Date(now.getTime() + PLAN_B_LOOKAHEAD_MS) } },
    select: { userId: true },
    distinct: ['userId']
  })
  let sent = 0
  for (const { userId } of users) {
    const offers = await planBOffers(userId, now).catch(() => [])
    for (const o of offers) {
      if (await notifyUser(userId, 'bookings', `booking:${o.booking.id}:planb-offer`, {
        title: `Rain on the way for ${o.booking.experience.name}`,
        body: `${o.rainChance}% chance of rain. Tap for an indoor Plan B — swapping takes one tap.`,
        url: '/bookings?planb=1'
      }, { whatsapp: 'BOOKING_REMINDER' })) sent++
    }
  }
  return sent
}

export async function runHomeNudges(now = new Date()): Promise<number> {
  const users = await prisma.user.findMany({
    where: { deletedAt: null, homeNudgeSentAt: null, tripEnd: { lte: new Date(now.getTime() - HOME_NUDGE_AFTER_MS), gte: new Date(now.getTime() - 60 * DAY) } },
    select: { id: true, points: true, tripEnd: true },
    take: 500
  })
  let sent = 0
  for (const u of users) {
    const body = u.points > 0
      ? `Your ${u.points.toLocaleString('en-US')} ETA points never expire — they’re waiting for you in Jamaica.`
      : 'Your ETA points never expire. Add your next dates and we’ll plan around them.'
    if (await notifyUser(u.id, 'trips', `trip:home:${u.tripEnd!.getTime()}`, { title: 'Planning your next trip?', body, url: '/rewards' })) sent++
    await prisma.user.update({ where: { id: u.id }, data: { homeNudgeSentAt: now } })
  }
  return sent
}
