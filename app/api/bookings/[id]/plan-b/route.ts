// POST /api/bookings/:id/plan-b { experienceId } — one-tap swap of a rained-out
// outdoor booking to an indoor option from GET /api/bookings/plan-b. Any
// price difference goes back to the wallet.
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { PlanBError, swapToPlanB } from '@/lib/plan-b'
import { SlotError } from '@/lib/slots'
import { notifyUser } from '@/lib/notify'
import { id, parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ experienceId: id }))
  if (!parsed.ok) return parsed.response
  try {
    const result = await swapToPlanB(auth.user.id, params.id, parsed.data.experienceId)
    await notifyUser(auth.user.id, 'bookings', `booking:${params.id}:planb:${parsed.data.experienceId}`, {
      title: `Plan B: ${result.to}`,
      body: `Swapped from ${result.from} because of the rain.`,
      url: '/bookings'
    }).catch(() => {})
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PlanBError || error instanceof SlotError) return NextResponse.json({ error: error.message }, { status: 409 })
    console.error('Plan B swap failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
