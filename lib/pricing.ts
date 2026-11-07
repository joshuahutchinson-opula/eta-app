// lib/pricing.ts — how a booking's total is built, shared by the booking
// sheets (what the traveler sees) and the booking routes (what's charged).

/**
 * ETA's service fee on experience and stay bookings. A placeholder rate for
 * the prototype — payments and fees aren't decided yet. Set to 0 to drop it.
 */
export const SERVICE_FEE_RATE = 0.05

export interface PriceBreakdown {
  unitPrice: number
  quantity: number
  subtotal: number
  fees: number
  total: number
}

const cents = (n: number) => Math.round(n * 100) / 100

export function priceBreakdown(unitPrice: number, quantity: number): PriceBreakdown {
  const subtotal = cents(unitPrice * quantity)
  const fees = cents(subtotal * SERVICE_FEE_RATE)
  return { unitPrice, quantity, subtotal, fees, total: cents(subtotal + fees) }
}

/** A "YYYY-MM-DD" date plus optional "HH:MM" time in Jamaica (UTC-5, no DST) as a Date. */
export function jamaicaDateTime(date: string, time?: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return null
  const t = time && /^(\d{1,2}):(\d{2})$/.exec(time)
  const hh = t ? Number(t[1]) : 12
  const mm = t ? Number(t[2]) : 0
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hh + 5, mm))
}

/** Today's date in Jamaica as "YYYY-MM-DD" (for date input minimums). */
export function jamaicaToday(offsetDays = 0): string {
  return new Date(Date.now() + offsetDays * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Jamaica' })
}

/** Short code printed on tickets and receipts. */
export function bookingCode(id: string): string {
  return `ETA-${id.slice(-8).toUpperCase()}`
}
