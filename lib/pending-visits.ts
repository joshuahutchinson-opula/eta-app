// lib/pending-visits.ts — a vendor's QR scanned with the phone camera by
// someone without ETA (no account on this phone). /v/<token> holds the
// visit here (with where they were, when the browser shares it) and shows
// the vendor's web page with "Get ETA to collect your points". If they sign
// up within 24 hours, the visit is credited like a normal QR visit
// (app/api/visits): the CheckIn, the points and the first-visit bonus —
// but only when they really were at the vendor when they scanned.
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { distanceM } from '@/lib/hidden-gems'
import { CHECKIN_POINTS, DISCOVERY_POINTS, QR_VISIT_RADIUS_M } from '@/lib/checkins'
import { parseScanned } from '@/lib/vendor-qr'
import { jamaicaDayKey } from '@/lib/trip-dates'

export const CLAIM_WINDOW_MS = 24 * 3600000

export async function holdVisit(code: string, pos: { lat: number; lng: number } | null) {
  const token = parseScanned(code)
  if (!token) return null
  const card = await prisma.vendorQrCard.findUnique({ where: { token }, include: { vendor: { select: { id: true, name: true, lat: true, lng: true } } } })
  if (!card) return null
  const dist = pos ? Math.round(distanceM(pos, card.vendor)) : null
  const row = await prisma.pendingVisit.create({
    data: { vendorId: card.vendor.id, claimToken: crypto.randomBytes(12).toString('base64url'), lat: pos?.lat ?? null, lng: pos?.lng ?? null, distanceM: dist }
  })
  return { claimToken: row.claimToken, vendor: { id: card.vendor.id, name: card.vendor.name }, onSite: dist !== null && dist <= QR_VISIT_RADIUS_M }
}

export type ClaimResult =
  | { ok: true; vendor: { id: string; name: string }; pointsAwarded: number; totalPoints: number }
  | { ok: false; reason: 'expired' | 'claimed' | 'notOnSite' | 'alreadyToday' | 'unknown' }

export async function claimVisit(userId: string, claimToken: string): Promise<ClaimResult> {
  const p = await prisma.pendingVisit.findUnique({ where: { claimToken }, include: { vendor: { select: { id: true, name: true } } } })
  if (!p) return { ok: false, reason: 'unknown' }
  if (p.claimedAt) return { ok: false, reason: 'claimed' }
  if (Date.now() - p.createdAt.getTime() > CLAIM_WINDOW_MS) return { ok: false, reason: 'expired' }
  if (p.distanceM === null || p.distanceM > QR_VISIT_RADIUS_M) {
    await prisma.pendingVisit.update({ where: { id: p.id }, data: { claimedAt: new Date(), claimedById: userId } })
    return { ok: false, reason: 'notOnSite' }
  }
  const dayStart = new Date(Date.parse(`${jamaicaDayKey(p.createdAt)}T00:00:00-05:00`))
  const already = await prisma.checkIn.findFirst({ where: { userId, vendorId: p.vendorId, createdAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400000) } } })
  if (already) {
    await prisma.pendingVisit.update({ where: { id: p.id }, data: { claimedAt: new Date(), claimedById: userId } })
    return { ok: false, reason: 'alreadyToday' }
  }
  const result = await prisma.$transaction(async tx => {
    const firstTime = !(await tx.discovery.findFirst({ where: { userId, vendorId: p.vendorId } }))
    const bonus = firstTime ? DISCOVERY_POINTS.vendor : 0
    await tx.checkIn.create({ data: { userId, vendorId: p.vendorId, lat: p.lat, lng: p.lng, distanceM: p.distanceM, method: 'qr', points: CHECKIN_POINTS, createdAt: p.createdAt } })
    if (firstTime) await tx.discovery.create({ data: { userId, vendorId: p.vendorId, type: 'VENDOR', points: bonus } })
    await tx.pendingVisit.update({ where: { id: p.id }, data: { claimedAt: new Date(), claimedById: userId } })
    const user = await tx.user.update({ where: { id: userId }, data: { points: { increment: CHECKIN_POINTS + bonus } }, select: { points: true } })
    return { pointsAwarded: CHECKIN_POINTS + bonus, totalPoints: user.points }
  })
  return { ok: true, vendor: p.vendor, ...result }
}
