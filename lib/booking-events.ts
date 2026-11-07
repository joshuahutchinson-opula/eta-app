// lib/booking-events.ts
// Side effects of a booking reaching COMPLETED. Callers must only invoke
// this on the transition into COMPLETED (never on an already-completed
// booking), which is what keeps every award here exactly-once.

import { prisma } from '@/lib/prisma'
import { earn } from '@/lib/points-ledger'

export async function onBookingCompleted(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, userId: true, pointsEarned: true } })
  if (!booking) return
  // The points shown on the booking ("+N pts") are credited when the trip is actually done.
  // (EARN.bookingPerDollar per $1, set when the booking was made.)
  if (booking.pointsEarned > 0) {
    await earn(prisma, { userId: booking.userId, reason: 'booking', points: booking.pointsEarned, sourceType: 'booking', sourceId: booking.id })
  }
}
