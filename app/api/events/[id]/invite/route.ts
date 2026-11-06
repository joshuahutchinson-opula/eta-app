// POST /api/events/:id/invite (signed in) — "I'm going, come with me": the
// caller's invite link for the event (one per person per event). The link
// opens the event with who invited them (/events/:id?inv=<token>).
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { absoluteUrl } from '@/lib/site-url'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { message: 'Log in to invite friends' })
  if (!auth.ok) return auth.response
  try {
    const event = await prisma.event.findUnique({ where: { id: params.id }, select: { id: true, title: true } })
    if (!event) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const invite = await prisma.eventInvite.upsert({
      where: { eventId_inviterId: { eventId: event.id, inviterId: auth.user.id } },
      create: { eventId: event.id, inviterId: auth.user.id, token: crypto.randomBytes(9).toString('base64url') },
      update: {}
    })
    return NextResponse.json({ token: invite.token, url: absoluteUrl(`/events/${event.id}?inv=${invite.token}`), title: event.title })
  } catch (error) {
    console.error('Event invite failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
