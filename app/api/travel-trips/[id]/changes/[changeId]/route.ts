// POST /api/travel-trips/:id/changes/:changeId { approve } — a group trip
// member confirms (or turns down) another member's new dates. Applied once
// everyone on the trip has confirmed.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { answerChange, TripError } from '@/lib/travel-trips'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string; changeId: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ approve: z.boolean() }))
  if (!parsed.ok) return parsed.response
  try {
    return NextResponse.json({ trip: await answerChange(auth.user.id, params.id, params.changeId, parsed.data.approve) })
  } catch (error) {
    if (error instanceof TripError) return NextResponse.json({ error: error.message }, { status: error.status })
    console.error('Trip change failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
