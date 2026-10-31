// GET — the latest position behind a live location link (public: whoever
// holds the link). Only the first name is shown; nothing after it ends.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const share = await prisma.safetyShare.findUnique({ where: { token: params.token }, include: { user: { select: { name: true } } } })
    if (!share) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const ended = Boolean(share.endedAt) || share.expiresAt.getTime() < Date.now()
    return NextResponse.json({
      name: share.user.name.split(' ')[0],
      active: !ended,
      lat: ended ? null : share.lat,
      lng: ended ? null : share.lng,
      accuracy: ended ? null : share.accuracy,
      updatedAt: share.updatedAt,
      expiresAt: share.expiresAt
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Error reading live location:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
