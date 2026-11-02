// lib/popular-times.ts — "Popular times" on vendor pages: an hour-of-day
// histogram of check-ins on today's weekday (Jamaica time) over the last
// 12 weeks. Returns null when there aren't enough check-ins to say anything,
// so the page hides the section instead of drawing invented bars.
import { prisma } from '@/lib/prisma'

export const POPULAR_TIMES_MIN_CHECKINS = 12
const WEEKS = 12
const OFFSET = 5 * 3600000

export interface PopularTimes {
  /** 0 = Sunday, in Jamaica time. */
  weekday: number
  /** 24 values, 0–1, relative to the busiest hour. */
  hours: number[]
  peakHour: number
  currentHour: number
  sample: number
}

export async function popularTimes(vendorId: string, now = new Date()): Promise<PopularTimes | null> {
  const local = new Date(now.getTime() - OFFSET)
  const weekday = local.getUTCDay()
  const rows = await prisma.checkIn.findMany({
    where: { vendorId, createdAt: { gte: new Date(now.getTime() - WEEKS * 7 * 86400000) } },
    select: { createdAt: true }
  })
  const counts = new Array<number>(24).fill(0)
  let sample = 0
  for (const r of rows) {
    const t = new Date(r.createdAt.getTime() - OFFSET)
    if (t.getUTCDay() !== weekday) continue
    counts[t.getUTCHours()]++
    sample++
  }
  if (sample < POPULAR_TIMES_MIN_CHECKINS) return null
  const max = Math.max(...counts)
  return {
    weekday,
    hours: counts.map(c => Math.round((c / max) * 100) / 100),
    peakHour: counts.indexOf(max),
    currentHour: local.getUTCHours(),
    sample
  }
}
