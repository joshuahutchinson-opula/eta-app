// GET /api/stories/replies (signed in) — replies and reactions to the
// caller's own stories, newest first (first names only).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const replies = await prisma.storyReply.findMany({
    where: { story: { userId: auth.user.id } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { name: true, avatarUrl: true } }, story: { select: { id: true, imageUrl: true } } }
  })
  return NextResponse.json(replies.map(r => ({ id: r.id, text: r.text, emoji: r.emoji, createdAt: r.createdAt, story: r.story, from: { name: r.user.name.split(' ')[0], avatarUrl: r.user.avatarUrl } })))
}
