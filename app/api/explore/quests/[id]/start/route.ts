// POST /api/explore/quests/:id/start (signed in) — start (or resume) a quest.
// Returns the first clue; checkpoint locations stay on the server.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request, { message: 'Log in to start a quest' })
  if (!auth.ok) return auth.response
  try {
    const quest = await prisma.quest.findFirst({ where: { id: params.id, active: true }, include: { checkpoints: { orderBy: { order: 'asc' }, select: { order: true, clue: true } } } })
    if (!quest || !quest.checkpoints.length) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
    const progress = await prisma.questProgress.upsert({ where: { questId_userId: { questId: quest.id, userId: auth.user.id } }, create: { questId: quest.id, userId: auth.user.id }, update: {} })
    const next = quest.checkpoints[progress.reached] ?? null
    return NextResponse.json({ questId: quest.id, reached: progress.reached, total: quest.checkpoints.length, completed: Boolean(progress.completedAt), nextClue: progress.completedAt ? null : next }, { status: 201 })
  } catch (error) {
    console.error('Quest start failed:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
