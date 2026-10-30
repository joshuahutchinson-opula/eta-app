// lib/events.ts — shared shape and formatting for promoter events.

export interface EventItem {
  id: string
  title: string
  promoterName: string
  description: string
  imageUrl: string | null
  videoUrl: string | null
  venueName: string
  lat: number | null
  lng: number | null
  startAt: string
  endAt: string | null
  price: number | null
  isFree: boolean
  ticketUrl: string | null
  city: string
  vendorId?: string | null
  vendor?: { id: string; name: string; images: string[] } | null
}

const TZ = 'America/Jamaica'

/** "Tonight · 9:00 PM", "Sat · 2:00 PM" — in Jamaica time. */
export function eventWhen(startAt: string, locale = 'en-US'): string {
  const start = new Date(startAt)
  const dayKey = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ })
  const today = dayKey(new Date())
  const tomorrow = dayKey(new Date(Date.now() + 86400000))
  const time = start.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ })
  const day = dayKey(start) === today ? (start.getTime() < Date.now() ? 'Now' : 'Today')
    : dayKey(start) === tomorrow ? 'Tomorrow'
    : start.toLocaleDateString(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: TZ })
  return `${day} · ${time}`
}

export function eventRange(startAt: string, endAt: string | null, locale = 'en-US'): string {
  const start = new Date(startAt)
  const full = start.toLocaleString(locale, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: TZ })
  if (!endAt) return full
  const end = new Date(endAt)
  return `${full} – ${end.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ })}`
}
