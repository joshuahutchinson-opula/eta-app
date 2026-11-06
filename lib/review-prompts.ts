// lib/review-prompts.ts — asking "How was <vendor>?" at the right moment:
// right after a QR visit (app/api/visits) or an in-app payment
// (app/api/pay). One prompt per vendor per Jamaica day; skipped, it comes
// back once later that day (two hours on), then it's gone. Not asked when
// they've reviewed the place in the last month.
import { prisma } from '@/lib/prisma'
import { jamaicaDayKey } from '@/lib/trip-dates'

const REMIND_AFTER_MS = 2 * 3600000
const RECENT_REVIEW_MS = 30 * 86400000

export async function promptReview(userId: string, vendorId: string, source: 'visit' | 'payment', sourceId?: string | null): Promise<void> {
  const recent = await prisma.review.findFirst({ where: { userId, vendorId, createdAt: { gt: new Date(Date.now() - RECENT_REVIEW_MS) } }, select: { id: true } })
  if (recent) return
  const day = jamaicaDayKey()
  await prisma.reviewPrompt.upsert({
    where: { userId_vendorId_day: { userId, vendorId, day } },
    create: { userId, vendorId, day, source, sourceId: sourceId ?? null },
    update: {}
  })
}

export interface DuePrompt {
  id: string
  reminder: boolean
  vendor: { id: string; name: string; image: string | null }
}

/** The prompt to show now: a fresh one first, else a skipped one that's due its one reminder. */
export async function duePrompt(userId: string, now = new Date()): Promise<DuePrompt | null> {
  const rows = await prisma.reviewPrompt.findMany({
    where: { userId, day: jamaicaDayKey(now), doneAt: null },
    orderBy: { createdAt: 'desc' },
    include: { vendor: { select: { id: true, name: true, images: true } } }
  })
  const fresh = rows.find(r => !r.shownAt && !r.skippedAt)
  const remind = rows.find(r => r.skippedAt && !r.remindedAt && now.getTime() - r.skippedAt.getTime() >= REMIND_AFTER_MS)
  const pick = fresh ?? remind
  return pick ? { id: pick.id, reminder: !fresh, vendor: { id: pick.vendor.id, name: pick.vendor.name, image: pick.vendor.images[0] ?? null } } : null
}

/** shown → on screen; skip → later (or gone, after the reminder); done → reviewed. */
export async function answerPrompt(userId: string, id: string, action: 'shown' | 'skip' | 'done'): Promise<void> {
  const p = await prisma.reviewPrompt.findFirst({ where: { id, userId } })
  if (!p) return
  const now = new Date()
  if (action === 'done') await prisma.reviewPrompt.update({ where: { id }, data: { doneAt: now } })
  else if (action === 'shown') await prisma.reviewPrompt.update({ where: { id }, data: p.skippedAt ? { remindedAt: now } : { shownAt: now } })
  else if (p.remindedAt) await prisma.reviewPrompt.update({ where: { id }, data: { doneAt: now } })
  else await prisma.reviewPrompt.update({ where: { id }, data: { skippedAt: now } })
}
