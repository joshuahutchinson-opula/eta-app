// lib/calendar.ts — "Add to calendar" for events and bookings: an .ics file
// (Apple Calendar, Outlook, most phones) and a Google Calendar link.

export interface CalendarItem {
  title: string
  start: Date
  /** Defaults to two hours after the start. */
  end?: Date | null
  location?: string | null
  description?: string | null
  url?: string | null
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
// RFC 5545 text escaping, and 75-octet line folding (approximated by characters).
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const fold = (line: string) => line.length <= 74 ? line : line.match(/.{1,73}/g)!.join('\r\n ')

function endOf(item: CalendarItem): Date {
  return item.end ?? new Date(item.start.getTime() + 2 * 3600000)
}

export function buildIcs(item: CalendarItem, uid: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ETA//Jamaica//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}@eta`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(item.start)}`,
    `DTEND:${stamp(endOf(item))}`,
    `SUMMARY:${esc(item.title)}`,
    ...(item.location ? [`LOCATION:${esc(item.location)}`] : []),
    ...(item.description || item.url ? [`DESCRIPTION:${esc([item.description, item.url].filter(Boolean).join('\n'))}`] : []),
    ...(item.url ? [`URL:${item.url}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(item.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
  return lines.map(fold).join('\r\n')
}

export function googleCalendarUrl(item: CalendarItem): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: item.title,
    dates: `${stamp(item.start)}/${stamp(endOf(item))}`,
    ...(item.location ? { location: item.location } : {}),
    ...(item.description || item.url ? { details: [item.description, item.url].filter(Boolean).join('\n') } : {}),
    ctz: 'America/Jamaica'
  })
  return `https://calendar.google.com/calendar/render?${q}`
}

/** Browser only: download the .ics so the phone offers to add it. */
export function downloadIcs(item: CalendarItem, uid: string, filename = 'eta-event') {
  const blob = new Blob([buildIcs(item, uid)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename.replace(/[^\w-]+/g, '-').toLowerCase()}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Google Maps directions to a point (or a place name). */
export function directionsUrl(to: { lat?: number | null; lng?: number | null; name?: string | null }, mode: 'walking' | 'driving' = 'driving'): string | null {
  const dest = typeof to.lat === 'number' && typeof to.lng === 'number' ? `${to.lat},${to.lng}` : to.name
  if (!dest) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${mode}`
}
