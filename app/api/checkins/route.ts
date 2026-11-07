// app/api/checkins/route.ts — check-ins.
// GET  → the signed-in caller's check-ins (newest first), vendor QR visits included.
// POST { photoSpotId, lat, lng, accuracy? } (signed in) — GPS check-in at a
// photo spot. Vendors are checked in by scanning their QR card instead
// (POST /api/visits). The caller must be within CHECKIN_RADIUS_M of the
// place. Earns EARN.photoSpotCheckIn once per spot per day, plus
// EARN.photoSpotFirst the first time (lib/earn-config.ts), as ledger entries.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { evaluateChallenges } from '@/lib/challenges'
import { distanceM, MAX_GPS_ACCURACY_M, parseCoord } from '@/lib/hidden-gems'
import { CHECKIN_RADIUS_M } from '@/lib/checkins'
import { EARN } from '@/lib/earn-config'
import { balances, earn } from '@/lib/points-ledger'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { startOfJamaicaDay } from '@/lib/booking-counts'
import { id, parseBody, z } from '@/lib/validate'

const schema = z.object({
  vendorId: id.optional(),
  photoSpotId: id.optional(),
  lat: z.number().finite().min(-90).max(90).optional(),
  lng: z.number().finite().min(-180).max(180).optional(),
  accuracy: z.number().finite().min(0).optional()
})

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  try {
    const checkIns = await prisma.checkIn.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { vendor: { select: { id: true, name: true } }, photoSpot: { select: { id: true, name: true } } }
    })
    return NextResponse.json(checkIns)
  } catch (error) {
    console.error('Error fetching check-ins:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to check in' })
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data
  const lat = parseCoord(body.lat, -90, 90)
  const lng = parseCoord(body.lng, -180, 180)
  const accuracy = Number(body.accuracy)
  if (lat === null || lng === null) return NextResponse.json({ error: 'We need your location to check you in' }, { status: 400 })
  if (Number.isFinite(accuracy) && accuracy > MAX_GPS_ACCURACY_M) {
    return NextResponse.json({ error: `Your GPS is fuzzy (±${Math.round(accuracy)} m). Step outside and try again.` }, { status: 422 })
  }
  if (body.vendorId) return NextResponse.json({ error: 'Scan the vendor’s ETA QR card to check in', code: 'USE_QR' }, { status: 400 })
  const vendorId = null
  const photoSpotId = body.photoSpotId ?? null
  if (!photoSpotId) return NextResponse.json({ error: 'Pick a place to check in' }, { status: 400 })

  try {
    const place = vendorId
      ? await prisma.vendor.findUnique({ where: { id: vendorId }, select: { lat: true, lng: true, name: true, city: true } })
      : await prisma.photoSpot.findUnique({ where: { id: photoSpotId! }, select: { lat: true, lng: true, name: true, city: true } })
    if (!place) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const dist = Math.round(distanceM({ lat, lng }, place))
    if (dist > CHECKIN_RADIUS_M) {
      return NextResponse.json({ error: `You’re ${dist} m away — get within ${CHECKIN_RADIUS_M} m to check in`, distanceM: dist }, { status: 403 })
    }

    const where = vendorId ? { userId, vendorId } : { userId, photoSpotId }
    const already = await prisma.checkIn.findFirst({ where: { ...where, createdAt: { gte: startOfJamaicaDay() } } })
    if (already) return NextResponse.json({ error: 'You already checked in here today', alreadyToday: true }, { status: 409 })

    const spot = photoSpotId!
    const result = await prisma.$transaction(async tx => {
      const firstTime = !(await tx.discovery.findFirst({ where }))
      const ci = await tx.checkIn.create({ data: { ...where, lat, lng, accuracy: Number.isFinite(accuracy) ? accuracy : null, distanceM: dist, method: 'gps', points: 0 } })
      let pts = await earn(tx, { userId, reason: 'photo_spot', points: EARN.photoSpotCheckIn, sourceType: 'photospot', sourceId: `${spot}:${jamaicaDayKey()}`, city: place.city })
      if (firstTime) {
        pts += await earn(tx, { userId, reason: 'photo_spot', points: EARN.photoSpotFirst, sourceType: 'photospot', sourceId: `${spot}:first`, city: place.city })
        await tx.discovery.create({ data: { ...where, type: 'PHOTOSPOT', points: EARN.photoSpotFirst } })
      }
      await tx.checkIn.update({ where: { id: ci.id }, data: { points: pts } })
      return { pointsAwarded: pts, firstDiscovery: firstTime }
    })
    // Monthly challenges this check-in completes pay their bonus now.
    const challenges = await evaluateChallenges(userId).catch(err => { console.error('Challenge check failed:', err); return [] })
    return NextResponse.json({ ...result, ...(await balances(userId)), place: place.name, challengesCompleted: challenges })
  } catch (error) {
    console.error('Error creating check-in:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
