// app/api/gems/[id]/confirm/route.ts — "I found it."
// Geofenced: the caller's GPS fix must be within REVEAL_RADIUS_M of the gem.
// Awards discovery points once per user per gem; for a pending gem it also
// counts toward verification, and the confirmation that crosses the threshold
// verifies the gem and pays its submitter a one-time bonus.
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { userIdFromRequest } from '@/lib/auth-server'
import {
  GEM_DISCOVERY_POINTS, GEM_SUBMITTER_BONUS, MAX_GPS_ACCURACY_M, REVEAL_RADIUS_M, VERIFY_THRESHOLD,
  distanceM, parseCoord
} from '@/lib/hidden-gems'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const userId = userIdFromRequest(request)
  if (!userId) return NextResponse.json({ error: 'Log in to confirm a find' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const lat = parseCoord(body.lat, -90, 90)
  const lng = parseCoord(body.lng, -180, 180)
  const accuracy = Number(body.accuracy)
  if (lat === null || lng === null) return NextResponse.json({ error: 'We need your live location to confirm' }, { status: 400 })
  if (Number.isFinite(accuracy) && accuracy > MAX_GPS_ACCURACY_M) {
    return NextResponse.json({ error: `Your GPS is fuzzy (±${Math.round(accuracy)} m). Step outside and try again.` }, { status: 422 })
  }

  try {
    const gem = await prisma.hiddenGem.findUnique({ where: { id: params.id } })
    if (!gem || gem.status === 'REJECTED') return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    if (gem.submittedByUserId === userId) return NextResponse.json({ error: 'You found this one first — others have to confirm it' }, { status: 403 })

    const dist = Math.round(distanceM({ lat, lng }, gem))
    if (dist > REVEAL_RADIUS_M) {
      return NextResponse.json({ error: `You’re ${dist} m away — get within ${REVEAL_RADIUS_M} m to confirm`, distanceM: dist }, { status: 403 })
    }

    const result = await prisma.$transaction(async tx => {
      await tx.gemConfirmation.create({ data: { userId, gemId: gem.id, lat, lng } })
      await tx.discovery.create({ data: { userId, hiddenGemId: gem.id, type: 'HIDDEN_GEM', points: GEM_DISCOVERY_POINTS } })
      await tx.user.update({ where: { id: userId }, data: { points: { increment: GEM_DISCOVERY_POINTS } } })

      if (gem.status !== 'PENDING') return { verifiedNow: false, confirmationCount: gem.confirmationCount, status: gem.status }

      const updated = await tx.hiddenGem.update({ where: { id: gem.id }, data: { confirmationCount: { increment: 1 } } })
      if (updated.confirmationCount < VERIFY_THRESHOLD) return { verifiedNow: false, confirmationCount: updated.confirmationCount, status: updated.status }

      // Guarded on the flag, so concurrent confirmations can't pay the bonus twice.
      const flipped = await tx.hiddenGem.updateMany({
        where: { id: gem.id, submitterRewarded: false },
        data: { status: 'VERIFIED', verifiedAt: new Date(), submitterRewarded: true }
      })
      if (flipped.count > 0) {
        await tx.discovery.create({ data: { userId: gem.submittedByUserId, hiddenGemId: gem.id, type: 'HIDDEN_GEM_VERIFIED', points: GEM_SUBMITTER_BONUS } })
        await tx.user.update({ where: { id: gem.submittedByUserId }, data: { points: { increment: GEM_SUBMITTER_BONUS } } })
      }
      return { verifiedNow: flipped.count > 0, confirmationCount: updated.confirmationCount, status: 'VERIFIED' as const }
    })

    return NextResponse.json({ pointsAwarded: GEM_DISCOVERY_POINTS, ...result })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'You’ve already confirmed this one' }, { status: 409 })
    }
    console.error('Error confirming gem:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
