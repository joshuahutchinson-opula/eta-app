// /api/vendor-app/quests/:id — edit or retire a quest.
// PUT { any field from POST } → updated. Checkpoints can only be moved or
//     added while nobody has started the quest; after that, send the same
//     checkpoints in the same places to edit their names and clues.
// DELETE → retired (active: false) once anyone has started it, else deleted.
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth-server'
import { canEditQuest, checkQuest, questSchema, QuestError } from '@/lib/quest-admin'
import { parseBody } from '@/lib/validate'

export const dynamic = 'force-dynamic'

async function load(id: string) {
  return prisma.quest.findUnique({ where: { id }, include: { checkpoints: { orderBy: { order: 'asc' } }, _count: { select: { progress: true } } } })
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const quest = await load(params.id)
  if (!quest) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  if (!(await canEditQuest(auth.user, quest))) return NextResponse.json({ error: 'You can’t edit this quest', code: 'FORBIDDEN' }, { status: 403 })
  const parsed = await parseBody(request, questSchema.partial())
  if (!parsed.ok) return parsed.response
  const q = parsed.data
  try {
    await checkQuest(auth.user, { ...q, vendorId: q.vendorId === undefined ? quest.vendorId : q.vendorId, rewardPoints: q.rewardPoints ?? quest.rewardPoints })
    const started = quest._count.progress > 0
    if (q.checkpoints && started) {
      const sameShape = q.checkpoints.length === quest.checkpoints.length && q.checkpoints.every((c, i) => Math.abs(c.lat - quest.checkpoints[i].lat) < 1e-6 && Math.abs(c.lng - quest.checkpoints[i].lng) < 1e-6)
      if (!sameShape) throw new QuestError('Explorers have started this quest — you can edit names and clues, not move or add checkpoints', 409)
    }
    await prisma.$transaction(async tx => {
      await tx.quest.update({
        where: { id: quest.id },
        data: {
          ...(q.title !== undefined ? { title: q.title } : {}),
          ...(q.description !== undefined ? { description: q.description } : {}),
          ...(q.city !== undefined ? { city: q.city as never } : {}),
          ...(q.badgeName !== undefined ? { badgeName: q.badgeName } : {}),
          ...(q.rewardPoints !== undefined ? { rewardPoints: q.rewardPoints } : {}),
          ...(q.rewardId !== undefined ? { rewardId: q.rewardId } : {}),
          ...(q.vendorId !== undefined ? { vendorId: q.vendorId } : {}),
          ...(q.active !== undefined ? { active: q.active } : {})
        }
      })
      if (!q.checkpoints) return
      if (started) {
        for (let i = 0; i < q.checkpoints.length; i++) {
          const c = q.checkpoints[i]
          await tx.questCheckpoint.update({ where: { id: quest.checkpoints[i].id }, data: { name: c.name, clue: c.clue, radiusM: c.radiusM ?? quest.checkpoints[i].radiusM, vendorId: c.vendorId ?? null } })
        }
      } else {
        await tx.questCheckpoint.deleteMany({ where: { questId: quest.id } })
        await tx.questCheckpoint.createMany({ data: q.checkpoints.map((c, i) => ({ questId: quest.id, order: i, name: c.name, clue: c.clue, lat: c.lat, lng: c.lng, radiusM: c.radiusM ?? 75, vendorId: c.vendorId ?? null })) })
      }
    })
    const { _count, ...rest } = (await load(quest.id))!
    return NextResponse.json({ ...rest, started: _count.progress })
  } catch (error) {
    if (error instanceof QuestError) return NextResponse.json({ error: error.message, code: error.status === 403 ? 'FORBIDDEN' : 'INVALID_BODY' }, { status: error.status })
    console.error('Error updating quest:', error)
    return NextResponse.json({ error: 'Sumth nah wuk' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireUser(request)
  if (!auth.ok) return auth.response
  const quest = await load(params.id)
  if (!quest) return NextResponse.json({ error: 'Nuttin nuh go suh' }, { status: 404 })
  if (!(await canEditQuest(auth.user, quest))) return NextResponse.json({ error: 'You can’t edit this quest', code: 'FORBIDDEN' }, { status: 403 })
  if (quest._count.progress > 0) {
    await prisma.quest.update({ where: { id: quest.id }, data: { active: false } })
    return NextResponse.json({ ok: true, retired: true })
  }
  await prisma.quest.delete({ where: { id: quest.id } })
  return NextResponse.json({ ok: true, deleted: true })
}
