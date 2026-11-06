// /api/travel-trips/:id/welcome-back — a returning traveler's gift for this
// trip (lib/welcome.ts: Reward rows with kind "welcome_back", so which gift,
// where, is data). One per trip.
// GET  → { reward } on offer for the trip's town (or null).
// POST → claims it: { redemption, alreadyClaimed }.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { claimWelcomeBack, welcomeBackRewardFor, WelcomeError } from '@/lib/welcome'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const trip = await prisma.travelTrip.findFirst({ where: { id: params.id, OR: [{ ownerId: auth.user.id }, { members: { some: { userId: auth.user.id } } }] }, select: { city: true, welcomeBackRedemptionId: true } })
  if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  return NextResponse.json({ reward: await welcomeBackRewardFor(trip.city), claimed: Boolean(trip.welcomeBackRedemptionId) })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { message: 'Log in to claim your gift' })
  if (!auth.ok) return auth.response
  try {
    const result = await claimWelcomeBack(auth.user.id, params.id)
    return NextResponse.json(result, { status: result.alreadyClaimed ? 200 : 201 })
  } catch (error) {
    if (error instanceof WelcomeError) return NextResponse.json({ error: error.message }, { status: 404 })
    console.error('Welcome-back claim failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
