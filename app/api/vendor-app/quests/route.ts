// /api/vendor-app/quests — quests for Explore mode (lib/quest-admin.ts).
// GET  → quests the caller can manage (all for ETA admins), with how many
//        explorers started and finished each.
// POST { title, description, city, badgeName, rewardPoints?, rewardId?,
//        vendorId?, active?, checkpoints: [{ name, clue, lat, lng, radiusM?,
//        vendorId? }] } → a new quest. Checkpoints are in trail order; a
//        checkpoint with vendorId can also be reached by scanning that QR card.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { checkQuest, questSchema, QuestError, slugify } from '@/lib/quest-admin'
import { parseBody } from '@/lib/validate'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  if (auth.user.role !== 'ADMIN' && auth.user.role !== 'VENDOR') return NextResponse.json({ error: 'Only vendors or ETA admins can do that', code: 'FORBIDDEN' }, { status: 403 })
  const quests = await prisma.quest.findMany({
    where: auth.user.role === 'ADMIN' ? {} : { OR: [{ createdById: auth.user.id }, { vendor: { ownerId: auth.user.id } }] },
    orderBy: { createdAt: 'desc' },
    include: { checkpoints: { orderBy: { order: 'asc' } }, _count: { select: { progress: true } } }
  })
  const finished = await prisma.questProgress.groupBy({ by: ['questId'], where: { questId: { in: quests.map(q => q.id) }, completedAt: { not: null } }, _count: { _all: true } })
  return NextResponse.json(quests.map(({ _count, ...q }) => ({ ...q, started: _count.progress, finished: finished.find(f => f.questId === q.id)?._count._all ?? 0 })))
}

export async function POST(request: Request) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const parsed = await parseBody(request, questSchema)
  if (!parsed.ok) return parsed.response
  const q = parsed.data
  try {
    await checkQuest(auth.user, q)
    const quest = await prisma.quest.create({
      data: {
        slug: slugify(q.title),
        title: q.title,
        description: q.description,
        city: q.city as never,
        badgeName: q.badgeName,
        rewardPoints: q.rewardPoints ?? 200,
        rewardId: q.rewardId ?? null,
        vendorId: q.vendorId ?? null,
        active: q.active ?? true,
        createdById: auth.user.id,
        checkpoints: { create: q.checkpoints.map((c, i) => ({ order: i, name: c.name, clue: c.clue, lat: c.lat, lng: c.lng, radiusM: c.radiusM ?? 75, vendorId: c.vendorId ?? null })) }
      },
      include: { checkpoints: { orderBy: { order: 'asc' } } }
    })
    return NextResponse.json(quest, { status: 201 })
  } catch (error) {
    if (error instanceof QuestError) return NextResponse.json({ error: error.message, code: error.status === 403 ? 'FORBIDDEN' : 'INVALID_BODY' }, { status: error.status })
    console.error('Error creating quest:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}
