// lib/visit-earn.ts — points for a QR visit, shared by the in-app scan
// (app/api/visits) and visits claimed after sign-up (lib/pending-visits.ts).
//   first visit to a vendor   EARN.qrFirstVisit   (source: the vendor)
//   repeat visit              EARN.qrRepeatVisit  (source: vendor + Jamaica day,
//                                                  so once a day per vendor)
// plus boosts (quiet hour, rainy day, birthday) stacked on the base.
// After the visit is committed, afterVisit() pays the 3-day streak, the
// referrer's bonus on a referred friend's first visit, and the crew bonus.
import type { TxClient } from '@/lib/wallet-pay'
import { prisma } from '@/lib/prisma'
import { EARN } from '@/lib/earn-config'
import { earn, earnBoosted, type BoostPlan, type EarnedLine } from '@/lib/points-ledger'
import { crewGroupsComplete, crewSourceId } from '@/lib/boosts'
import { addDays, jamaicaDayKey } from '@/lib/trip-dates'
import { streaks } from '@/lib/passport'
import { rewardReferralOnFirstVisit } from '@/lib/referrals'

export async function earnForVisit(
  db: TxClient,
  input: { userId: string; vendor: { id: string; city: string }; firstTime: boolean; checkInId: string; at?: Date },
  plan: BoostPlan
): Promise<EarnedLine[]> {
  const at = input.at ?? new Date()
  return earnBoosted(db, {
    userId: input.userId,
    reason: input.firstTime ? 'qr_first_visit' : 'qr_repeat_visit',
    points: input.firstTime ? EARN.qrFirstVisit : EARN.qrRepeatVisit,
    sourceType: 'checkin',
    sourceId: input.firstTime ? input.vendor.id : `${input.vendor.id}:${jamaicaDayKey(at)}`,
    city: input.vendor.city,
    vendorId: input.vendor.id
  }, plan)
}

/** The extras a visit can trigger, once it's saved. Each is paid at most once. */
export async function afterVisit(userId: string, vendor: { id: string; city: string }): Promise<EarnedLine[]> {
  const out: EarnedLine[] = []

  // 3-day streak: once per run of consecutive days (source: the run's first day).
  const days = new Set((await prisma.checkIn.findMany({ where: { userId, createdAt: { gte: new Date(Date.now() - 60 * 86400000) } }, select: { createdAt: true } })).map(c => jamaicaDayKey(c.createdAt)))
  const { current } = streaks(days)
  if (current >= 3 && days.has(jamaicaDayKey())) {
    const start = addDays(jamaicaDayKey(), -(current - 1))
    const n = await earn(prisma, { userId, reason: 'streak3', points: EARN.streak3, sourceType: 'streak', sourceId: start, city: vendor.city, vendorId: vendor.id })
    if (n) out.push({ reason: 'streak3', points: n })
  }

  // A referred friend's first visit pays whoever referred them (tourists and locals alike).
  await rewardReferralOnFirstVisit(userId).catch(err => console.error('Referral payout failed:', err))

  // Crew bonus: the whole group checked in here together.
  const groups = await crewGroupsComplete(userId, vendor.id).catch(() => [])
  for (const group of groups) {
    for (const member of group) {
      const n = await earn(prisma, { userId: member, reason: 'crew_bonus', points: EARN.crewBonus, sourceType: 'crew', sourceId: crewSourceId(vendor.id), city: vendor.city, vendorId: vendor.id })
      if (n && member === userId) out.push({ reason: 'crew_bonus', points: n })
    }
  }
  return out
}
