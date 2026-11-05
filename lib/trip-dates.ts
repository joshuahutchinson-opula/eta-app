// lib/trip-dates.ts — trip mode's day maths, in Jamaica days (UTC-5, no
// DST). Shared by the server (profile API, recap, nudges) and the app.

const OFFSET = 5 * 3600000
const DAY = 86400000

/** "2026-11-05" → the instant that Jamaica day starts. */
export function jamaicaDayStart(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + OFFSET)
}

/** The Jamaica day an instant falls on, "YYYY-MM-DD". */
export function jamaicaDayKey(at: Date | number = Date.now()): string {
  return new Date(new Date(at).getTime() - OFFSET).toISOString().slice(0, 10)
}

export function addDays(date: string, n: number): string {
  return jamaicaDayKey(jamaicaDayStart(date).getTime() + n * DAY)
}

export interface TripProgress {
  phase: 'before' | 'during' | 'after'
  /** 1-based day of the trip today (clamped to the trip). */
  day: number
  total: number
  /** Days left including today, while the trip is on. */
  daysLeft: number
  /** Until the first day, before the trip. */
  daysUntil: number
}

export function tripProgress(start: string, end: string, now: Date | number = Date.now()): TripProgress {
  const today = jamaicaDayStart(jamaicaDayKey(now)).getTime()
  const s = jamaicaDayStart(start).getTime()
  const e = jamaicaDayStart(end).getTime()
  const total = Math.max(1, Math.round((e - s) / DAY) + 1)
  if (today < s) return { phase: 'before', day: 0, total, daysLeft: total, daysUntil: Math.round((s - today) / DAY) }
  if (today > e) return { phase: 'after', day: total, total, daysLeft: 0, daysUntil: 0 }
  const day = Math.round((today - s) / DAY) + 1
  return { phase: 'during', day, total, daysLeft: total - day + 1, daysUntil: 0 }
}

/** The remaining trip days from today, "YYYY-MM-DD" each. */
export function remainingDays(start: string, end: string, now: Date | number = Date.now()): string[] {
  const p = tripProgress(start, end, now)
  if (p.phase === 'after') return []
  const first = p.phase === 'before' ? start : jamaicaDayKey(now)
  return Array.from({ length: p.daysLeft }, (_, i) => addDays(first, i))
}
