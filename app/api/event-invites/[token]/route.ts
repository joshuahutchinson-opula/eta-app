// GET /api/event-invites/:token — who sent this event invite (first name and
// photo) and which event, for the "<name> is going — come with them" banner.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: { token: string } }) {
  const invite = await prisma.eventInvite.findUnique({
    where: { token: params.token },
    select: { eventId: true, inviter: { select: { name: true, avatarUrl: true, deletedAt: true } } }
  }).catch(() => null)
  if (!invite || invite.inviter.deletedAt) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  return NextResponse.json({ eventId: invite.eventId, inviter: { name: invite.inviter.name.split(' ')[0], avatarUrl: invite.inviter.avatarUrl } })
}
