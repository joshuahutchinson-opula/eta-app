// GET /api/explore?city= (signed in) — Explore mode's state for a town, from
// the account (lib/explore.ts): progress, cleared fog, secret-spot zones
// (exact only once found), quests, badges and explorer perks.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { exploreState } from '@/lib/explore'
import { parseCity } from '@/lib/regions'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to play Explore mode' })
  if (!auth.ok) return auth.response
  try {
    return NextResponse.json(await exploreState(auth.user.id, parseCity(new URL(request.url).searchParams.get('city'))))
  } catch (error) {
    console.error('Explore state failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
