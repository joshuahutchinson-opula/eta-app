// POST /api/stories/:id/reply { text?, emoji? } (signed in) — a reply or an
// emoji reaction to a story, from the story viewer. The vendor sees replies
// to their stories in the vendor app; travelers at /api/stories/replies.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { rateLimit } from '@/lib/rate-limit'
import { REACTIONS } from '@/lib/story-overlays'
import { parseBody, text, z } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const schema = z.object({ text: text(500).optional(), emoji: z.enum(REACTIONS).optional() }).refine(b => Boolean(b.text?.trim() || b.emoji), 'Write a reply or pick a reaction')

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { message: 'Log in to reply' })
  if (!auth.ok) return auth.response
  const limited = rateLimit('story', auth.user.id)
  if (limited) return limited
  const parsed = await parseBody(request, schema)
  if (!parsed.ok) return parsed.response
  try {
    const story = await prisma.story.findFirst({ where: { id: params.id, hidden: false, expiresAt: { gt: new Date() } }, select: { id: true } })
    if (!story) return NextResponse.json({ error: 'That story has gone' }, { status: 404 })
    const reply = await prisma.storyReply.create({ data: { storyId: story.id, userId: auth.user.id, text: parsed.data.text?.trim() || null, emoji: parsed.data.emoji ?? null } })
    return NextResponse.json({ id: reply.id }, { status: 201 })
  } catch (error) {
    console.error('Story reply failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
