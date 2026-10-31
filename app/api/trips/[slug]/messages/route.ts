// Crew chat on a trip. GET ?after=<iso> → messages (newest last).
// POST { body, kind? } — "quick" messages are the one-tap ones ("Running
// late", "Here", "Meet at…"). Owners and members only; the rest of the crew
// gets a "crew" notification.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { isCrew, tripAccess } from '@/lib/trips'
import { notifyUser } from '@/lib/notify'
import { rateLimit } from '@/lib/rate-limit'
import { parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: { params: { slug: string } }) {
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request)
    if (!isCrew(access)) return NextResponse.json({ error: 'Join the crew to see messages' }, { status: 403 })
    const after = new URL(request.url).searchParams.get('after')
    const messages = await prisma.tripMessage.findMany({
      where: { tripId: trip.id, ...(after && !isNaN(Date.parse(after)) ? { createdAt: { gt: new Date(after) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { member: { select: { id: true, name: true } } }
    })
    return NextResponse.json(messages.reverse().map(m => ({ id: m.id, body: m.body, kind: m.kind, createdAt: m.createdAt, memberId: m.member.id, name: m.member.name })))
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

const schema = z.object({ body: text(500).min(1), kind: z.enum(['text', 'quick']).default('text') })

export async function POST(request: Request, { params }: { params: { slug: string } }) {
  const auth = await requireUser(request, { message: 'Log in to message your crew' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('message', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const trip = await prisma.trip.findUnique({ where: { slug: params.slug }, include: { members: { select: { id: true, userId: true } } } })
    if (!trip) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const access = await tripAccess(trip, request)
    if (!isCrew(access) || !access.member) return NextResponse.json({ error: 'Join the crew to message them' }, { status: 403 })
    const msg = await prisma.tripMessage.create({ data: { tripId: trip.id, memberId: access.member.id, body: parsed.data.body, kind: parsed.data.kind } })
    for (const m of trip.members) {
      if (m.userId && m.userId !== auth.user.id) {
        await notifyUser(m.userId, 'crew', `trip:${trip.id}:msg:${msg.id}`, { title: `${access.member.name} · ${trip.name}`, body: parsed.data.body, url: `/trip/${trip.slug}`, tag: `trip-chat-${trip.id}` }).catch(() => {})
      }
    }
    return NextResponse.json({ id: msg.id, body: msg.body, kind: msg.kind, createdAt: msg.createdAt, memberId: access.member.id, name: access.member.name }, { status: 201 })
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
