// GET /api/trip-recap/:token — a shared trip recap (public, read-only):
// first name only, the places and what was booked.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildRecap } from '@/lib/trip-recap'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  try {
    const share = await prisma.tripRecap.findUnique({ where: { token: params.token } })
    const recap = share ? await buildRecap(share.userId, share.start, share.end) : null
    if (!recap) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    return NextResponse.json(recap)
  } catch (error) {
    console.error('Shared recap failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
