// lib/booking-events.ts
// Side effects of a booking reaching COMPLETED. Callers must only invoke
// this on the transition into COMPLETED (never on an already-completed
// booking), which is what keeps every award here exactly-once.

import { prisma } from '@/lib/prisma'
import { rewardReferralOnFirstBooking } from '@/lib/referrals'

export async function onBookingCompleted(bookingId: string): Promise<void> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, userId: true, pointsEarned: true } })
  if (!booking) return
  // The points shown on the booking ("+N pts") are credited when the trip is actually done.
  if (booking.pointsEarned > 0) {
    await prisma.user.update({ where: { id: booking.userId }, data: { points: { increment: booking.pointsEarned } } })
  }
  // A friend's first completed booking pays out their referral (B10).
  await rewardReferralOnFirstBooking(booking.userId).catch(err => console.error('Referral payout failed:', err))
}
