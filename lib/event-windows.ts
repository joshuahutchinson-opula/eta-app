// lib/event-windows.ts — the All Events filters, in Jamaica time (UTC-5,
// no DST). "Tonight" is from now until 4 am; "This weekend" is Friday 5 pm
// to Sunday midnight (or the rest of it, if it's already the weekend).
export const EVENT_WINDOWS = ['tonight', 'tomorrow', 'weekend', 'week'] as const
export type EventWindow = (typeof EVENT_WINDOWS)[number]

const OFFSET = 5 * 3600000
const HOUR = 3600000
const DAY = 24 * HOUR

/** Midnight (Jamaica) of the day `days` from today, as a UTC Date. */
function jamaicaMidnight(now: Date, days = 0): Date {
  const local = new Date(now.getTime() - OFFSET)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days) + OFFSET)
}

export function windowRange(w: EventWindow, now = new Date()): { from: Date; to: Date } {
  const today = jamaicaMidnight(now)
  switch (w) {
    case 'tonight':
      return { from: now, to: new Date(today.getTime() + DAY + 4 * HOUR) }
    case 'tomorrow':
      return { from: jamaicaMidnight(now, 1), to: jamaicaMidnight(now, 2) }
    case 'weekend': {
      const weekday = new Date(now.getTime() - OFFSET).getUTCDay() // 0 Sun … 6 Sat
      const toFriday = weekday === 0 ? -2 : 5 - weekday
      const fridayEvening = new Date(jamaicaMidnight(now, toFriday).getTime() + 17 * HOUR)
      const mondayStart = jamaicaMidnight(now, weekday === 0 ? 1 : 8 - weekday)
      return { from: new Date(Math.max(fridayEvening.getTime(), now.getTime())), to: mondayStart }
    }
    case 'week':
      return { from: now, to: new Date(now.getTime() + 7 * DAY) }
  }
}
