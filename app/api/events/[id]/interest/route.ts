// POST { interested } — "I'm interested" on an event. Returns the new count.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { parseBody, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { message: 'Log in to mark that you’re interested' })
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, z.object({ interested: z.boolean() }))
  if (!parsed.ok) return parsed.response
  try {
    const event = await prisma.event.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!event) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const key = { eventId_userId: { eventId: event.id, userId: auth.user.id } }
    if (parsed.data.interested) await prisma.eventInterest.upsert({ where: key, create: { eventId: event.id, userId: auth.user.id }, update: {} })
    else await prisma.eventInterest.deleteMany({ where: { eventId: event.id, userId: auth.user.id } })
    const interestedCount = await prisma.eventInterest.count({ where: { eventId: event.id } })
    return NextResponse.json({ interested: parsed.data.interested, interestedCount })
  } catch (error) {
    console.error('Error updating interest:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
