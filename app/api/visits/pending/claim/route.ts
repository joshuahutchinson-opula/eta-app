// POST /api/visits/pending/claim { claimToken } (signed in) — credits a
// visit held from a camera scan before they had ETA (lib/pending-visits.ts).
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { claimVisit } from '@/lib/pending-visits'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ claimToken: z.string().trim().min(8).max(64) }))
  if (!parsed.ok) return parsed.response
  try {
    const result = await claimVisit(auth.user.id, parsed.data.claimToken)
    return NextResponse.json(result, { status: result.ok ? 201 : 200 })
  } catch (error) {
    console.error('Claiming visit failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
