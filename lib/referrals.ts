// lib/referrals.ts
// Referral program. A user (tourist or local) shares their code; a friend
// registers with it (Referral row, PENDING). When that friend makes their
// first QR visit, the referrer earns REFERRAL_POINTS (EARN.referralFirstVisit)
// as a ledger entry. The PENDING → REWARDED transition is a conditional
// update, so the payout can only ever happen once.

import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { earn } from '@/lib/points-ledger'

export { REFERRAL_POINTS } from '@/lib/points'
import { REFERRAL_POINTS } from '@/lib/points'

function makeCode(name: string): string {
  const base = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'ETA'
  // No 0/O/1/I so codes survive being read aloud or typed from a screenshot.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const suffix = Array.from(crypto.randomBytes(4), b => alphabet[b % alphabet.length]).join('')
  return `${base}-${suffix}`
}

export async function ensureReferralCode(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, referralCode: true } })
  if (!user) return null
  if (user.referralCode) return user.referralCode
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const updated = await prisma.user.update({ where: { id: userId }, data: { referralCode: makeCode(user.name) }, select: { referralCode: true } })
      return updated.referralCode
    } catch {
      // unique collision — try another suffix
    }
  }
  return null
}

export async function findReferrer(code: unknown): Promise<{ id: string } | null> {
  if (typeof code !== 'string' || !code.trim()) return null
  return prisma.user.findUnique({ where: { referralCode: code.trim().toUpperCase() }, select: { id: true } })
}

/** Called after a QR visit. Pays the referrer once, on the referred friend's first visit (lib/visit-earn.ts). */
export async function rewardReferralOnFirstVisit(refereeId: string): Promise<boolean> {
  const referral = await prisma.referral.findUnique({ where: { refereeId } })
  if (!referral || referral.status !== 'PENDING') return false
  return prisma.$transaction(async tx => {
    const claimed = await tx.referral.updateMany({
      where: { id: referral.id, status: 'PENDING' },
      data: { status: 'REWARDED', pointsAwarded: REFERRAL_POINTS, rewardedAt: new Date() }
    })
    if (claimed.count === 0) return false
    await earn(tx, { userId: referral.referrerId, reason: 'referral', points: REFERRAL_POINTS, sourceType: 'referral', sourceId: referral.id })
    return true
  })
}

export async function getReferralSummary(userId: string) {
  const code = await ensureReferralCode(userId)
  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    orderBy: { createdAt: 'desc' },
    include: { referee: { select: { name: true } } }
  })
  return {
    code,
    pointsPerReferral: REFERRAL_POINTS,
    invited: referrals.length,
    rewarded: referrals.filter(r => r.status === 'REWARDED').length,
    pointsEarned: referrals.reduce((sum, r) => sum + r.pointsAwarded, 0),
    friends: referrals.map(r => ({ name: r.referee.name.split(' ')[0], status: r.status, joinedAt: r.createdAt.toISOString() }))
  }
}
