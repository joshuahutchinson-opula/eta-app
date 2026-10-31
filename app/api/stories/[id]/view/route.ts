// POST — the signed-in viewer has seen this story (drives the ring's
// seen/unseen state on Home).
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  try {
    const story = await prisma.story.findUnique({ where: { id: params.id }, select: { id: true } })
    if (!story) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId: story.id, userId: auth.user.id } },
      create: { storyId: story.id, userId: auth.user.id },
      update: {}
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error marking story seen:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
