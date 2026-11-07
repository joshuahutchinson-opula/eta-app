// lib/points-ledger.ts — the only way points move. Every earn and spend is
// a PointsLedger row (reason + source); earns raise both the spendable
// balance and lifetime points (status), spends lower only the balance.
// (userId, reason, sourceId) is unique and inserts skip duplicates, so the
// same visit, payment or review can never pay twice — even inside a
// transaction (no aborted transaction on a repeat).
//
// Rules: points are never cash. There is no withdrawal and no transfer
// between users — nothing here moves points from one user to another.
//
// Fraud protection: after an earn, unusually fast earning (FRAUD in
// lib/earn-config.ts) raises a FraudAlert and emails the admins.
import type { City } from '@prisma/client'
import type { TxClient } from '@/lib/wallet-pay'
import { prisma } from '@/lib/prisma'
import { EARN, FRAUD, type EarnReason, type SpendReason } from '@/lib/earn-config'
import { atLeast } from '@/lib/rewardTiers'
import { boostsForVendor, type BoostLine } from '@/lib/boosts'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { emailConfigured, send } from '@/lib/email'

type Db = TxClient

export interface EarnInput {
  userId: string
  reason: EarnReason
  points: number
  sourceType?: string
  /** Unique per reason per user (a visit id, "<vendorId>:<day>", a booking id…). */
  sourceId: string
  city?: City | string | null
  vendorId?: string | null
}

/** Credits points once. Returns the points credited (0 when it already paid out). */
export async function earn(db: Db, input: EarnInput): Promise<number> {
  const points = Math.floor(input.points)
  if (points <= 0) return 0
  const made = await db.pointsLedger.createMany({
    data: [{ userId: input.userId, points, kind: 'earn', reason: input.reason, sourceType: input.sourceType ?? null, sourceId: input.sourceId, city: (input.city as City) ?? null, vendorId: input.vendorId ?? null }],
    skipDuplicates: true
  })
  if (!made.count) return 0
  await db.user.update({ where: { id: input.userId }, data: { points: { increment: points }, lifetimePoints: { increment: points } } })
  scheduleFraudCheck(input.userId)
  return points
}

export class SpendError extends Error {}

/** Takes points off the spendable balance (never below zero). Throws SpendError when there aren't enough. */
export async function spend(db: Db, input: { userId: string; reason: SpendReason; points: number; sourceType?: string; sourceId: string; city?: City | string | null; vendorId?: string | null }): Promise<number> {
  const points = Math.floor(input.points)
  if (points <= 0) return 0
  const debited = await db.user.updateMany({ where: { id: input.userId, points: { gte: points } }, data: { points: { decrement: points } } })
  if (!debited.count) throw new SpendError('Not enough points')
  await db.pointsLedger.create({
    data: { userId: input.userId, points: -points, kind: input.reason === 'donate' ? 'donate' : 'spend', reason: input.reason, sourceType: input.sourceType ?? null, sourceId: input.sourceId, city: (input.city as City) ?? null, vendorId: input.vendorId ?? null }
  })
  return points
}

export interface BoostPlan { lines: BoostLine[]; birthday: boolean }

/**
 * What stacks on an earn right now: the vendor's quiet-hour boost, the
 * rainy-day boost at indoor spots, and double points on the user's
 * birthday (Explorer and up). Call before the transaction — it may check
 * the weather.
 */
export async function planBoosts(userId: string, vendor: { id: string; city: string; indoor: boolean } | null, at = Date.now()): Promise<BoostPlan> {
  const [lines, user] = await Promise.all([
    vendor ? boostsForVendor(vendor, at).catch(() => []) : Promise.resolve([]),
    prisma.user.findUnique({ where: { id: userId }, select: { birthday: true, lifetimePoints: true } })
  ])
  const today = jamaicaDayKey(at).slice(5)
  const birthday = Boolean(user?.birthday && user.birthday === today && atLeast(user.lifetimePoints, 'EXPLORER'))
  return { lines, birthday }
}

export interface EarnedLine { reason: string; points: number }

/** The base earn plus every boost in the plan, each its own ledger row. Returns the lines credited. */
export async function earnBoosted(db: Db, input: EarnInput, plan: BoostPlan): Promise<EarnedLine[]> {
  const out: EarnedLine[] = []
  const base = await earn(db, input)
  if (!base) return out
  out.push({ reason: input.reason, points: base })
  const src = `${input.reason}:${input.sourceId}`
  for (const line of plan.lines) {
    const extra = await earn(db, { ...input, reason: line.reason, points: base * (line.multiplier - 1), sourceType: 'boost', sourceId: src })
    if (extra) out.push({ reason: line.reason, points: extra })
  }
  if (plan.birthday) {
    const extra = await earn(db, { ...input, reason: 'birthday', points: base, sourceType: 'birthday', sourceId: src })
    if (extra) out.push({ reason: 'birthday', points: extra })
  }
  return out
}

export const sumLines = (lines: EarnedLine[]) => lines.reduce((n, l) => n + l.points, 0)

/** Current balances after a change. */
export async function balances(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { points: true, lifetimePoints: true } })
  return { totalPoints: u?.points ?? 0, lifetimePoints: u?.lifetimePoints ?? 0 }
}

// ---------- Fraud: unusually fast earning ----------

const pendingChecks = new Map<string, ReturnType<typeof setTimeout>>()

/** Runs shortly after the earn (so the transaction has committed); one check per user at a time. */
function scheduleFraudCheck(userId: string) {
  if (pendingChecks.has(userId)) return
  pendingChecks.set(userId, setTimeout(() => {
    pendingChecks.delete(userId)
    checkEarnRate(userId).catch(err => console.error('Fraud check failed:', err))
  }, 1500))
}

export async function checkEarnRate(userId: string): Promise<boolean> {
  const since = new Date(Date.now() - FRAUD.windowMs)
  const agg = await prisma.pointsLedger.aggregate({ where: { userId, kind: 'earn', createdAt: { gte: since }, isMock: false }, _sum: { points: true }, _count: true })
  const points = agg._sum.points ?? 0
  const earns = agg._count
  if (points <= FRAUD.maxPoints && earns <= FRAUD.maxEarns) return false
  // One open alert per user per window.
  const open = await prisma.fraudAlert.findFirst({ where: { userId, resolvedAt: null, createdAt: { gte: since } }, select: { id: true } })
  if (open) return true
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } })
  await prisma.fraudAlert.create({ data: { userId, kind: 'fast_earning', detail: { points, earns, windowMinutes: FRAUD.windowMs / 60000 } } })
  console.warn(`[fraud] ${user?.email ?? userId} earned ${points} pts in ${earns} earns within ${FRAUD.windowMs / 60000} min`)
  if (emailConfigured()) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', deletedAt: null }, select: { email: true } })
    const text = `${user?.name ?? 'A user'} (${user?.email ?? userId}) earned ${points} points in ${earns} earns within the last ${FRAUD.windowMs / 60000} minutes. Check the PointsLedger before their next redemption.`
    await Promise.all(admins.map(a => send({ to: a.email, subject: 'ETA: unusually fast earning', text, html: `<p>${text}</p>` }).catch(() => false)))
  }
  return true
}

/** Exported for the How To Earn screen and tests. */
export { EARN }
