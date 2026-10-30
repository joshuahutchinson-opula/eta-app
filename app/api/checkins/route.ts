// app/api/checkins/route.ts — checking in at a vendor or photo spot.
// GET  → the signed-in caller's check-ins (newest first).
// POST { vendorId | photoSpotId, lat, lng, accuracy? } (signed in) — the
// caller must be within CHECKIN_RADIUS_M of the place. Earns CHECKIN_POINTS
// once per place per day, plus a one-time Discovery bonus the first time
// (same amounts as elsewhere: vendor 50, photo spot 30). Points are added
// server-side.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import { distanceM, MAX_GPS_ACCURACY_M, parseCoord } from '@/lib/hidden-gems'
import { CHECKIN_POINTS, CHECKIN_RADIUS_M, DISCOVERY_POINTS } from '@/lib/checkins'
import { startOfJamaicaDay } from '@/lib/booking-counts'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json([])
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
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in to check in' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  const lat = parseCoord(body.lat, -90, 90)
  const lng = parseCoord(body.lng, -180, 180)
  const accuracy = Number(body.accuracy)
  if (lat === null || lng === null) return NextResponse.json({ error: 'We need your location to check you in' }, { status: 400 })
  if (Number.isFinite(accuracy) && accuracy > MAX_GPS_ACCURACY_M) {
    return NextResponse.json({ error: `Your GPS is fuzzy (±${Math.round(accuracy)} m). Step outside and try again.` }, { status: 422 })
  }
  const vendorId = typeof body.vendorId === 'string' ? body.vendorId : null
  const photoSpotId = !vendorId && typeof body.photoSpotId === 'string' ? body.photoSpotId : null
  if (!vendorId && !photoSpotId) return NextResponse.json({ error: 'Pick a place to check in' }, { status: 400 })

  try {
    const place = vendorId
      ? await prisma.vendor.findUnique({ where: { id: vendorId }, select: { lat: true, lng: true, name: true } })
      : await prisma.photoSpot.findUnique({ where: { id: photoSpotId! }, select: { lat: true, lng: true, name: true } })
    if (!place) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const dist = Math.round(distanceM({ lat, lng }, place))
    if (dist > CHECKIN_RADIUS_M) {
      return NextResponse.json({ error: `You’re ${dist} m away — get within ${CHECKIN_RADIUS_M} m to check in`, distanceM: dist }, { status: 403 })
    }

    const where = vendorId ? { userId, vendorId } : { userId, photoSpotId }
    const already = await prisma.checkIn.findFirst({ where: { ...where, createdAt: { gte: startOfJamaicaDay() } } })
    if (already) return NextResponse.json({ error: 'You already checked in here today', alreadyToday: true }, { status: 409 })

    const result = await prisma.$transaction(async tx => {
      const firstTime = !(await tx.discovery.findFirst({ where }))
      const discoveryPoints = firstTime ? DISCOVERY_POINTS[vendorId ? 'vendor' : 'photospot'] : 0
      await tx.checkIn.create({ data: { ...where, lat, lng, points: CHECKIN_POINTS } })
      if (firstTime) await tx.discovery.create({ data: { ...where, type: vendorId ? 'VENDOR' : 'PHOTOSPOT', points: discoveryPoints } })
      const user = await tx.user.update({ where: { id: userId }, data: { points: { increment: CHECKIN_POINTS + discoveryPoints } }, select: { points: true } })
      return { pointsAwarded: CHECKIN_POINTS + discoveryPoints, firstDiscovery: firstTime, totalPoints: user.points }
    })
    return NextResponse.json({ ...result, place: place.name })
  } catch (error) {
    console.error('Error creating check-in:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
