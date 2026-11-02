// lib/account.ts — "Delete my account" and "Download my data" (Profile →
// Settings), in line with the Jamaica Data Protection Act's rights of
// access and erasure.
//
// Deleting removes what's personal (photos, stories, reviews, saves,
// location history, devices, emergency contact) and anonymises the user
// row. Bookings, tickets and payments are kept, attached to the anonymised
// account, because vendors and accounting need them.
import { prisma } from '@/lib/prisma'

export async function deleteAccount(userId: string): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.story.deleteMany({ where: { userId } })
    await tx.userMoment.deleteMany({ where: { userId } })
    await tx.moodMedia.deleteMany({ where: { userId } })
    await tx.review.deleteMany({ where: { userId } })
    await tx.saved.deleteMany({ where: { userId } })
    await tx.savedList.deleteMany({ where: { userId } })
    await tx.eventInterest.deleteMany({ where: { userId } })
    await tx.storyView.deleteMany({ where: { userId } })
    await tx.checkIn.deleteMany({ where: { userId } })
    await tx.gemConfirmation.deleteMany({ where: { userId } })
    await tx.safetyShare.deleteMany({ where: { userId } })
    await tx.notificationLog.deleteMany({ where: { userId } })
    await tx.alertSubscription.deleteMany({ where: { userId } })
    await tx.passwordResetToken.deleteMany({ where: { userId } })
    await tx.emailVerificationToken.deleteMany({ where: { userId } })
    await tx.reservationRequest.updateMany({ where: { userId }, data: { note: null } })
    await tx.tripMember.updateMany({ where: { userId }, data: { userId: null, name: 'Former member', sharingLocation: false, lat: null, lng: null, locationAt: null } })
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${userId}@deleted.invalid`,
        name: 'Deleted user',
        password: null,
        avatarUrl: null,
        bio: null,
        homeCountry: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        referralCode: null,
        leaderboardOptIn: false,
        deletedAt: new Date(),
        tokenVersion: { increment: 1 }
      }
    })
  })
}

/** Everything ETA holds about the user, as plain JSON. */
export async function exportAccount(userId: string) {
  const [user, bookings, tickets, reservations, transactions, reviews, checkIns, discoveries, saved, savedLists, redemptions, stories, moments, trips, notifications] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.booking.findMany({ where: { userId }, include: { experience: { select: { name: true } }, accommodation: { select: { name: true } }, vendor: { select: { name: true } } } }),
    prisma.ticket.findMany({ where: { userId }, include: { event: { select: { title: true, startAt: true, venueName: true } } } }),
    prisma.reservationRequest.findMany({ where: { userId }, include: { vendor: { select: { name: true } } } }),
    prisma.transaction.findMany({ where: { userId } }),
    prisma.review.findMany({ where: { userId }, include: { vendor: { select: { name: true } }, experience: { select: { name: true } } } }),
    prisma.checkIn.findMany({ where: { userId }, include: { vendor: { select: { name: true } }, photoSpot: { select: { name: true } } } }),
    prisma.discovery.findMany({ where: { userId } }),
    prisma.saved.findMany({ where: { userId } }),
    prisma.savedList.findMany({ where: { userId }, include: { items: true } }),
    prisma.redemption.findMany({ where: { userId } }),
    prisma.story.findMany({ where: { userId } }),
    prisma.userMoment.findMany({ where: { userId } }),
    prisma.tripMember.findMany({ where: { userId }, include: { trip: { select: { name: true, slug: true, date: true, status: true } } } }),
    prisma.notificationLog.findMany({ where: { OR: [{ userId }, { subscription: { userId } }] }, select: { title: true, body: true, createdAt: true, readAt: true } })
  ])
  if (!user) return null
  const { password: _p, tokenVersion: _t, ...profile } = user
  return {
    exportedAt: new Date().toISOString(),
    profile,
    bookings, tickets, reservations, transactions, reviews, checkIns, discoveries,
    saved, savedLists, redemptions, stories, moments,
    trips: trips.map(m => ({ trip: m.trip, memberName: m.name, paid: m.paid })),
    notifications
  }
}
