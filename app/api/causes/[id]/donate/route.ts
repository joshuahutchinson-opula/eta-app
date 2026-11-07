// POST { points } (signed in) — donate points to a Give Back cause
// (lib/causes.ts). Any amount from 10 up to the caller's balance.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { donate, DonateError } from '@/lib/causes'
import { badgesFor } from '@/lib/badges'
import { rateLimit } from '@/lib/rate-limit'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { message: 'Log in to give back' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('donate', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, z.object({ points: z.number().int().min(10, 'Give at least 10 points').max(1000000) }))
  if (!parsed.ok) return parsed.response
  try {
    const result = await donate(auth.user.id, params.id, parsed.data.points)
    const { badges, unlocked } = await badgesFor(auth.user.id).catch(() => ({ badges: [], unlocked: [] as string[] }))
    return NextResponse.json({ ...result, badgesUnlocked: badges.filter(b => unlocked.includes(b.key)) }, { status: 201 })
  } catch (error) {
    if (error instanceof DonateError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Donation failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
