// /api/travel-trips/join — a friend's trip invite link (/trips/join/<code>).
// GET  ?code= → a preview (town, dates, stay, who's going), no sign-in.
// POST { code } (signed in) → joins it: their trip takes its dates and town.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { invitePreview, joinTrip, TripError } from '@/lib/travel-trips'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code') ?? ''
  if (!/^[A-Za-z0-9]{6,16}$/.test(code)) return NextResponse.json({ error: 'That trip link doesn’t work any more' }, { status: 404 })
  const preview = await invitePreview(code).catch(() => null)
  return preview ? NextResponse.json(preview) : NextResponse.json({ error: 'That trip link doesn’t work any more' }, { status: 404 })
}

export async function POST(request: Request) {
  const auth = await requireUser(request, { message: 'Log in to join the trip' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ code: z.string().trim().min(6).max(16) }))
  if (!parsed.ok) return parsed.response
  try {
    return NextResponse.json({ trip: await joinTrip(auth.user.id, parsed.data.code) })
  } catch (error) {
    if (error instanceof TripError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Joining trip failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
