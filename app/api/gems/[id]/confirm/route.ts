// app/api/gems/[id]/confirm/route.ts — "I found it."
// Geofenced: the caller's GPS fix must be within REVEAL_RADIUS_M of the gem.
// Out of range, the reply never says how far (no distance oracle); calls are
// rate-limited.
// Awards discovery points once per user per gem (none if Explore mode
// already revealed it to them); for a pending gem it also
// counts toward verification, and the confirmation that crosses the threshold
// verifies the gem and pays its submitter a one-time bonus.
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { earn } from '@/lib/points-ledger'
import { requireUser } from '@/lib/auth-server'
import { rateLimit } from '@/lib/rate-limit'
import {
  GEM_DISCOVERY_POINTS, GEM_SUBMITTER_BONUS, MAX_GPS_ACCURACY_M, REVEAL_RADIUS_M, VERIFY_THRESHOLD,
  distanceM, parseCoord
} from '@/lib/hidden-gems'

import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({ lat: z.number().finite(), lng: z.number().finite(), accuracy: z.number().finite().min(0).optional() })

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { message: 'Log in to confirm a find' })
  if (!auth.ok) return auth.response
  const userId = auth.user.id
  const limited = rateLimit('gemConfirm', userId)
  if (limited) return limited

  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return NextResponse.json({ error: 'We need your live location to confirm' }, { status: 400 })
  const body = parsed.data
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

    // Never say how far off the caller is: a distance from a few made-up
    // positions would pinpoint the spot without anyone going there.
    if (distanceM({ lat, lng }, gem) > REVEAL_RADIUS_M) {
      return NextResponse.json({ error: `Get within ${REVEAL_RADIUS_M} m of it to confirm`, code: 'TOO_FAR' }, { status: 403 })
    }

    // Walking into range in Explore mode already counted the find (lib/explore.ts).
    const alreadyFound = Boolean(await prisma.discovery.findFirst({ where: { userId, hiddenGemId: gem.id }, select: { id: true } }))
    const pointsAwarded = alreadyFound ? 0 : GEM_DISCOVERY_POINTS
    const result = await prisma.$transaction(async tx => {
      await tx.gemConfirmation.create({ data: { userId, gemId: gem.id, lat, lng } })
      if (!alreadyFound) {
        await tx.discovery.create({ data: { userId, hiddenGemId: gem.id, type: 'HIDDEN_GEM', points: GEM_DISCOVERY_POINTS } })
        await earn(tx, { userId, reason: 'secret_spot', points: GEM_DISCOVERY_POINTS, sourceType: 'gem', sourceId: gem.id })
      }

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
        await earn(tx, { userId: gem.submittedByUserId, reason: 'gem_verified', points: GEM_SUBMITTER_BONUS, sourceType: 'gem', sourceId: gem.id })
      }
      return { verifiedNow: flipped.count > 0, confirmationCount: updated.confirmationCount, status: 'VERIFIED' as const }
    })

    return NextResponse.json({ pointsAwarded, ...result })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ error: 'You’ve already confirmed this one' }, { status: 409 })
    }
    console.error('Error confirming gem:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
