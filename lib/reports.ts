// lib/reports.ts — reporting user content (photos, stories, reviews, hidden
// gems). Once a piece of content has REPORT_HIDE_THRESHOLD pending reports
// it's hidden everywhere until someone reviews it. There's no admin UI yet:
// review in the database (Report rows, then flip `hidden` back if it's fine).
import type { ReportTarget } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/** Pending reports that hide content. Override with REPORT_HIDE_THRESHOLD. */
export const REPORT_HIDE_THRESHOLD = Math.max(1, Number(process.env.REPORT_HIDE_THRESHOLD) || 3)

export const REPORT_REASONS = ['SPAM', 'INAPPROPRIATE', 'HARASSMENT', 'MISLEADING', 'NOT_THERE', 'OTHER'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_TARGETS = ['MOMENT', 'MOOD_MEDIA', 'STORY', 'REVIEW', 'HIDDEN_GEM'] as const satisfies readonly ReportTarget[]

/** True when the target exists (so reports can't be filed against made-up ids). */
export async function targetExists(type: ReportTarget, id: string): Promise<boolean> {
  const where = { where: { id }, select: { id: true } }
  switch (type) {
    case 'MOMENT': return Boolean(await prisma.userMoment.findUnique(where))
    case 'MOOD_MEDIA': return Boolean(await prisma.moodMedia.findUnique(where))
    case 'STORY': return Boolean(await prisma.story.findUnique(where))
    case 'REVIEW': return Boolean(await prisma.review.findUnique(where))
    case 'HIDDEN_GEM': return Boolean(await prisma.hiddenGem.findUnique(where))
  }
}

/** Hides the target once enough reports are pending. Returns whether it's hidden now. */
export async function hideIfReported(type: ReportTarget, id: string): Promise<boolean> {
  const pending = await prisma.report.count({ where: { targetType: type, targetId: id, status: 'PENDING' } })
  if (pending < REPORT_HIDE_THRESHOLD) return false
  const data = { where: { id }, data: { hidden: true } }
  switch (type) {
    case 'MOMENT': await prisma.userMoment.update(data); break
    case 'MOOD_MEDIA': await prisma.moodMedia.update(data); break
    case 'STORY': await prisma.story.update(data); break
    case 'REVIEW': await prisma.review.update(data); break
    case 'HIDDEN_GEM': await prisma.hiddenGem.update(data); break
  }
  return true
}
