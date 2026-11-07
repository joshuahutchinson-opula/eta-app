// POST /api/vendor-app/mentions/:id { decision: "approve" | "reject" } — the
// vendor decides whether an Instagram story tagging @ETA shows in their ETA
// story. Approving pays the traveller EARN.storyTag (once per story).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EARN } from '@/lib/earn-config'
import { earn } from '@/lib/points-ledger'
import { requireVendorAccess } from '@/lib/vendor-app'
import { requireUser } from '@/lib/auth-server'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const mention = await prisma.instagramMention.findUnique({ where: { id: params.id }, select: { id: true, vendorId: true, userId: true, expiresAt: true, vendor: { select: { city: true } } } })
  if (!mention) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  const access = await requireVendorAccess(request, mention.vendorId)
  if (!access.ok) return access.response
  const parsed = await parseBody(request, z.object({ decision: z.enum(['approve', 'reject']) }))
  if (!parsed.ok) return parsed.response
  if (mention.expiresAt.getTime() <= Date.now()) return NextResponse.json({ error: 'This story has expired' }, { status: 410 })
  try {
    const updated = await prisma.instagramMention.update({
      where: { id: mention.id },
      data: { status: parsed.data.decision === 'approve' ? 'APPROVED' : 'REJECTED', decidedAt: new Date(), decidedById: access.user.id },
      select: { id: true, status: true, decidedAt: true, expiresAt: true }
    })
    const pointsAwarded = updated.status === 'APPROVED'
      ? await earn(prisma, { userId: mention.userId, reason: 'story_tag', points: EARN.storyTag, sourceType: 'mention', sourceId: mention.id, city: mention.vendor.city, vendorId: mention.vendorId })
      : 0
    return NextResponse.json({ ...updated, pointsAwarded })
  } catch (error) {
    console.error('Error deciding mention:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
