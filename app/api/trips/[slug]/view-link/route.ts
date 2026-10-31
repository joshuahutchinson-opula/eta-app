// POST — a read-only link to follow this trip's progress (Safety → share
// live trip), for people outside the crew. Owners and members only.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { isCrew, newToken, tripAccess } from '@/lib/trips'
import { absoluteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request)
    if (!isCrew(access)) return NextResponse.json({ error: 'Only the crew can share this trip' }, { status: 403 })
    const viewToken = trip.viewToken ?? (await prisma.trip.update({ where: { id: trip.id }, data: { viewToken: newToken() } })).viewToken!
    return NextResponse.json({ url: absoluteUrl(`/trip/${trip.slug}?view=${viewToken}`) })
  } catch (error) {
    console.error('Error creating view link:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
