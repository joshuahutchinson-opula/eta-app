// lib/availability.ts — is a stay free for a date range? A night is taken
// when it's blocked (AccommodationBlockedDate) or inside another active booking.
import { prisma } from '@/lib/prisma'

/** Each night from check-in up to (not including) check-out, as "YYYY-MM-DD". */
export function nightsOf(checkIn: string, checkOut: string): string[] {
  const out: string[] = []
  const start = Date.parse(`${checkIn}T00:00:00Z`)
  const end = Date.parse(`${checkOut}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return out
  for (let t = start; t < end && out.length < 60; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

export async function unavailableNights(accommodationId: string, checkIn: string, checkOut: string): Promise<string[]> {
  const nights = nightsOf(checkIn, checkOut)
  if (nights.length === 0) return []
  const from = new Date(`${nights[0]}T00:00:00Z`)
  const to = new Date(`${checkOut}T00:00:00Z`)
  const [blocked, bookings] = await Promise.all([
    prisma.accommodationBlockedDate.findMany({ where: { accommodationId, date: { gte: from, lt: to } }, select: { date: true } }),
    prisma.booking.findMany({
      where: { accommodationId, status: { in: ['PENDING', 'CONFIRMED'] }, date: { lt: to }, OR: [{ endDate: { gt: from } }, { endDate: null, date: { gte: from } }] },
      select: { date: true, endDate: true }
    })
  ])
  const taken = new Set(blocked.map(b => b.date.toISOString().slice(0, 10)))
  for (const b of bookings) {
    const start = b.date.toISOString().slice(0, 10)
    const end = (b.endDate ?? new Date(b.date.getTime() + 86400000)).toISOString().slice(0, 10)
    for (const n of nightsOf(start, end)) taken.add(n)
  }
  return nights.filter(n => taken.has(n))
}
