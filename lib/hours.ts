// lib/hours.ts — vendor opening hours (Vendor.hours) and "open now".
// Shape: { mon: [["09:00","17:00"]], tue: [...], ... } in Jamaica time.
// A day that's missing or empty is closed; ranges past midnight ("20:00"–"02:00")
// spill into the next morning.

export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export type DayKey = (typeof DAYS)[number]
export type Hours = Partial<Record<DayKey, Array<[string, string]>>>

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function parseHours(value: unknown): Hours | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Hours = {}
  for (const d of DAYS) {
    const ranges = (value as Record<string, unknown>)[d]
    if (Array.isArray(ranges)) {
      out[d] = ranges.filter((r): r is [string, string] => Array.isArray(r) && r.length === 2 && r.every(x => typeof x === 'string' && /^\d{1,2}:\d{2}$/.test(x)))
    }
  }
  return out
}

function jamaicaNow(now = new Date()): { day: number; minutes: number } {
  const local = new Date(now.getTime() - 5 * 3600000)
  return { day: local.getUTCDay(), minutes: local.getUTCHours() * 60 + local.getUTCMinutes() }
}

export interface OpenState {
  open: boolean
  /** "Closes 10:00 PM" / "Opens 9:00 AM tomorrow" — null when unknown. */
  detail: { kind: 'closes' | 'opens'; time: string; dayOffset: number } | null
}

export function openState(hours: Hours, now = new Date()): OpenState {
  const { day, minutes } = jamaicaNow(now)
  const ranges = (d: number) => hours[DAYS[(d + 7) % 7]] ?? []
  // Today's ranges, plus yesterday's ones that run past midnight.
  for (const [a, b] of ranges(day)) {
    const start = toMin(a)
    let end = toMin(b)
    if (end <= start) end += 1440
    if (minutes >= start && minutes < end) return { open: true, detail: { kind: 'closes', time: b, dayOffset: 0 } }
  }
  for (const [a, b] of ranges(day - 1)) {
    const start = toMin(a)
    const end = toMin(b)
    if (end <= start && minutes < end) return { open: true, detail: { kind: 'closes', time: b, dayOffset: 0 } }
  }
  for (let offset = 0; offset < 7; offset++) {
    const upcoming = ranges(day + offset).map(([a]) => a).filter(a => offset > 0 || toMin(a) > minutes).sort((x, y) => toMin(x) - toMin(y))
    if (upcoming.length) return { open: false, detail: { kind: 'opens', time: upcoming[0], dayOffset: offset } }
  }
  return { open: false, detail: null }
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 || h === 24 ? 'AM' : 'PM'}`
}
