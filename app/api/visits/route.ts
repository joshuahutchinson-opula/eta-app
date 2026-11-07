// app/api/visits/route.ts — checking in by scanning a vendor's QR card.
// POST { code, lat, lng, accuracy? } (signed in). `code` is whatever the
// scanner read: the card's /v/<token> link, the token, or the printed code.
// The caller must be within QR_VISIT_RADIUS_M of the vendor, once per vendor
// per Jamaica day. Logs the visit (CheckIn, method "qr" — the vendor's
// proof of visit), earns EARN.qrFirstVisit or EARN.qrRepeatVisit plus any
// boosts (lib/visit-earn.ts — every point a ledger entry), then the 3-day
// streak, referral and crew bonuses, and returns the vendor's rewards the
// visit unlocks and any badges it completes. A quest
// checkpoint at this vendor counts, and via "explore" (scanning from Explore
// mode) can unlock the vendor's explorer-only perks (lib/explore.ts).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { evaluateChallenges } from '@/lib/challenges'
import { distanceM, MAX_GPS_ACCURACY_M } from '@/lib/hidden-gems'
import { QR_VISIT_RADIUS_M } from '@/lib/checkins'
import { balances, planBoosts, sumLines } from '@/lib/points-ledger'
import { afterVisit, earnForVisit } from '@/lib/visit-earn'
import { badgesFor } from '@/lib/badges'
import { startOfJamaicaDay } from '@/lib/booking-counts'
import { parseScanned } from '@/lib/vendor-qr'
import { rateLimit } from '@/lib/rate-limit'
import { onExploreScan } from '@/lib/explore'
import { promptReview } from '@/lib/review-prompts'
import { lat, lng, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({
  code: z.string().trim().min(4).max(300),
  lat,
  lng,
  accuracy: z.number().finite().min(0).optional(),
  via: z.enum(['explore']).optional()
})

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to check in and earn points' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('visit', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const { code, accuracy } = parsed.data
  const userId = auth.user.id

  const token = parseScanned(code)
  if (!token) return NextResponse.json({ error: 'That isn’t an ETA vendor code', code: 'QR_INVALID' }, { status: 400 })
  if (accuracy !== undefined && accuracy > MAX_GPS_ACCURACY_M) {
    return NextResponse.json({ error: `Your GPS is fuzzy (±${Math.round(accuracy)} m). Step outside and try again.`, code: 'GPS_FUZZY' }, { status: 422 })
  }

  try {
    const card = await prisma.vendorQrCard.findUnique({
      where: { token },
      include: { vendor: { select: { id: true, name: true, lat: true, lng: true, city: true, indoor: true } } }
    })
    if (!card) return NextResponse.json({ error: 'That isn’t an ETA vendor code', code: 'QR_INVALID' }, { status: 404 })
    const vendor = card.vendor
    const dist = Math.round(distanceM({ lat: parsed.data.lat, lng: parsed.data.lng }, vendor))
    if (dist > QR_VISIT_RADIUS_M) {
      return NextResponse.json({ error: `You’re ${dist} m from ${vendor.name} — scan the card when you’re there`, code: 'TOO_FAR', distanceM: dist, radiusM: QR_VISIT_RADIUS_M, vendor: { id: vendor.id, name: vendor.name } }, { status: 403 })
    }

    const already = await prisma.checkIn.findFirst({ where: { userId, vendorId: vendor.id, createdAt: { gte: startOfJamaicaDay() } } })
    if (already) {
      // No points twice a day, but a quest checkpoint or explorer perk here still counts.
      const explore = await onExploreScan(userId, vendor, parsed.data.via ?? null).catch(() => ({ quests: [], perks: [] }))
      return NextResponse.json({ error: 'You already checked in here today', code: 'ALREADY_TODAY', alreadyToday: true, vendor: { id: vendor.id, name: vendor.name }, explore }, { status: 409 })
    }

    const plan = await planBoosts(userId, vendor)
    const visit = await prisma.$transaction(async tx => {
      const firstTime = !(await tx.discovery.findFirst({ where: { userId, vendorId: vendor.id } }))
      const checkIn = await tx.checkIn.create({
        data: { userId, vendorId: vendor.id, lat: parsed.data.lat, lng: parsed.data.lng, accuracy: accuracy ?? null, distanceM: dist, method: 'qr', points: 0 }
      })
      const lines = await earnForVisit(tx, { userId, vendor, firstTime, checkInId: checkIn.id }, plan)
      await tx.checkIn.update({ where: { id: checkIn.id }, data: { points: sumLines(lines) } })
      if (firstTime) await tx.discovery.create({ data: { userId, vendorId: vendor.id, type: 'VENDOR', points: 0 } })
      return { visitId: checkIn.id, firstDiscovery: firstTime, lines }
    })
    const extras = await afterVisit(userId, vendor).catch(err => { console.error('After-visit bonuses failed:', err); return [] })
    const lines = [...visit.lines, ...extras]
    const badgeCheck = await badgesFor(userId).catch(() => ({ badges: [], unlocked: [] as string[] }))
    const result = { visitId: visit.visitId, firstDiscovery: visit.firstDiscovery, pointsAwarded: sumLines(lines), lines, ...(await balances(userId)), badgesUnlocked: badgeCheck.badges.filter(b => badgeCheck.unlocked.includes(b.key)) }

    // The vendor's rewards that need a visit are now redeemable.
    const unlocked = await prisma.reward.findMany({
      where: { active: true, requiresVisit: true, vendors: { some: { vendorId: vendor.id } } },
      select: { id: true, name: true, cost: true, icon: true }
    })
    const challenges = await evaluateChallenges(userId).catch(err => { console.error('Challenge check failed:', err); return [] })
    const explore = await onExploreScan(userId, vendor, parsed.data.via ?? null).catch(err => { console.error('Explore scan failed:', err); return { quests: [], perks: [] } })
    // "How was <vendor>?" right after the visit.
    await promptReview(userId, vendor.id, 'visit', result.visitId).catch(err => console.error('Review prompt failed:', err))
    return NextResponse.json({ ...result, vendor: { id: vendor.id, name: vendor.name }, unlockedRewards: unlocked, challengesCompleted: challenges, explore }, { status: 201 })
  } catch (error) {
    console.error('Error logging visit:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
