// lib/vouchers.ts — single-use reward vouchers.
//   Redeeming (redeemReward) spends points through the ledger and issues a
//   voucher code, checking tier, audience, visit locks and the reward's caps
//   (redemptions per Jamaica day and per month).
//   High-value rewards (Reward.rotatingQr) show a QR that changes every 30 s
//   (voucherQrValue): "<code>.<token>", signed server-side, so a screenshot
//   or a forwarded code doesn't work. The vendor confirms (confirmVoucher)
//   by scanning; only then is the voucher used.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { jwtSecret } from '@/lib/auth-server'
import { atLeast, type TierKey } from '@/lib/rewardTiers'
import { spend, SpendError } from '@/lib/points-ledger'
import { startOfJamaicaDay } from '@/lib/booking-counts'
import { jamaicaDayKey } from '@/lib/trip-dates'

const STEP_MS = 30000

function sign(code: string, step: number): string {
  return crypto.createHmac('sha256', jwtSecret()).update(`${code}:${step}`).digest('base64url').slice(0, 10)
}

/** The value a rotating voucher QR shows right now, and when it changes. */
export function voucherQrValue(code: string, at = Date.now()): { value: string; refreshAt: number } {
  const step = Math.floor(at / STEP_MS)
  return { value: `${code}.${sign(code, step)}`, refreshAt: (step + 1) * STEP_MS }
}

/** "ETA-ABCD1234.tok" or "ETA-ABCD1234" → its parts. */
export function parseVoucher(scanned: string): { code: string; token: string | null } {
  const [code, token] = scanned.trim().split('.')
  return { code: code.toUpperCase(), token: token || null }
}

/** Valid for the current or previous 30 s window (scanning takes a moment). */
export function tokenValid(code: string, token: string | null, at = Date.now()): boolean {
  if (!token) return false
  const step = Math.floor(at / STEP_MS)
  return [step, step - 1].some(s => crypto.timingSafeEqual(Buffer.from(sign(code, s)), Buffer.from(token.padEnd(10).slice(0, 10))))
}

export class VoucherError extends Error {
  constructor(message: string, public status = 409, public code?: string) { super(message) }
}

const monthStart = () => new Date(Date.parse(`${jamaicaDayKey().slice(0, 7)}-01T00:00:00-05:00`))

/** How many more of this reward can be redeemed today and this month. */
export async function capsLeft(reward: { id: string; dailyCap: number; monthlyBudget: number }) {
  const [today, month] = await Promise.all([
    prisma.redemption.count({ where: { rewardId: reward.id, createdAt: { gte: startOfJamaicaDay() } } }),
    prisma.redemption.count({ where: { rewardId: reward.id, createdAt: { gte: monthStart() } } })
  ])
  return { today: Math.max(0, reward.dailyCap - today), month: Math.max(0, reward.monthlyBudget - month) }
}

/** Spend points on a catalog reward. Returns the voucher and the new balance. */
export async function redeemReward(userId: string, rewardId: string) {
  const reward = await prisma.reward.findFirst({ where: { id: rewardId, active: true, kind: 'catalog' }, include: { vendors: { select: { vendorId: true } } } })
  if (!reward) throw new VoucherError('Nuttin nuh go suh', 404)
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { points: true, lifetimePoints: true, travelerType: true, city: true } })
  if (!user) throw new VoucherError('Log in to redeem rewards', 401)
  if (reward.audience === 'local' && user.travelerType !== 'LOCAL') throw new VoucherError('This one is for locals', 403, 'LOCALS_ONLY')
  if (reward.minTier && !atLeast(user.lifetimePoints, reward.minTier as TierKey)) throw new VoucherError(`${reward.minTier} status needed`, 403, 'TIER_REQUIRED')
  if (reward.requiresVisit) {
    const visit = await prisma.checkIn.findFirst({ where: { userId, method: 'qr', vendorId: { in: reward.vendors.map(v => v.vendorId) } }, select: { id: true } })
    if (!visit) throw new VoucherError('Scan the vendor’s ETA QR card on your visit to unlock this', 403, 'VISIT_REQUIRED')
  }
  const left = await capsLeft(reward)
  if (left.today <= 0) throw new VoucherError('All gone for today — try again tomorrow', 409, 'CAP_DAY')
  if (left.month <= 0) throw new VoucherError('All gone for this month', 409, 'CAP_MONTH')

  try {
    return await prisma.$transaction(async tx => {
      const redemption = await tx.redemption.create({
        data: {
          userId, rewardId: reward.id, rewardName: reward.name, pointCost: reward.cost,
          code: `ETA-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          expiresAt: new Date(Date.now() + reward.validDays * 86400000)
        }
      })
      await spend(tx, { userId, reason: 'redeem', points: reward.cost, sourceType: 'redemption', sourceId: redemption.id, city: reward.city ?? user.city })
      const after = await tx.user.findUnique({ where: { id: userId }, select: { points: true, lifetimePoints: true } })
      return { redemption: { ...redemption, rotatingQr: reward.rotatingQr }, points: after?.points ?? 0, lifetimePoints: after?.lifetimePoints ?? 0 }
    })
  } catch (e) {
    if (e instanceof SpendError) throw new VoucherError('Yuh nave nuff points fi dat yet', 409, 'NOT_ENOUGH')
    throw e
  }
}

/**
 * A vendor confirms a voucher: scanned "<code>.<token>" (or the printed
 * code, for rewards without a rotating QR). Single use: conditional on
 * still ACTIVE. `spendAmount` is what the customer spent on the visit
 * (for the vendor's redemptions report).
 */
export async function confirmVoucher(input: { vendorId: string; scanned: string; confirmedById: string; spendAmount?: number | null }) {
  const { code, token } = parseVoucher(input.scanned)
  const redemption = await prisma.redemption.findUnique({ where: { code } })
  if (!redemption) throw new VoucherError('Nuttin nuh go suh', 404)
  if (redemption.status === 'USED') throw new VoucherError('This voucher was already used', 409, 'USED')
  if (redemption.status === 'EXPIRED' || (redemption.expiresAt && redemption.expiresAt.getTime() < Date.now())) throw new VoucherError('This voucher has expired', 410, 'EXPIRED')
  const reward = await prisma.reward.findUnique({ where: { id: redemption.rewardId }, select: { rotatingQr: true, vendors: { select: { vendorId: true } } } })
  if (reward?.vendors.length && !reward.vendors.some(v => v.vendorId === input.vendorId)) throw new VoucherError('This reward isn’t offered at this vendor', 403, 'WRONG_VENDOR')
  if (reward?.rotatingQr && !tokenValid(code, token)) throw new VoucherError('Scan the live QR on the traveller’s phone (screenshots don’t work for this reward)', 403, 'QR_STALE')
  const done = await prisma.redemption.updateMany({
    where: { id: redemption.id, status: 'ACTIVE' },
    data: { status: 'USED', usedAt: new Date(), vendorId: input.vendorId, confirmedById: input.confirmedById, spendAmount: input.spendAmount ?? null }
  })
  if (!done.count) throw new VoucherError('This voucher was already used', 409, 'USED')
  const tier = await prisma.user.findUnique({ where: { id: redemption.userId }, select: { name: true, lifetimePoints: true } })
  return { ok: true, rewardName: redemption.rewardName, customer: tier ? { name: tier.name.split(' ')[0], lifetimePoints: tier.lifetimePoints } : null }
}
