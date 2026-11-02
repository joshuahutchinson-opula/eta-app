// lib/slots.ts — per-start-time capacity for experiences. Spots taken are
// the party sizes of bookings that aren't cancelled; capacity is the
// experience's capacityPerSlot unless an ExperienceSlot override (vendor
// app) changes or closes that slot. Times are Jamaica time.
import { prisma } from '@/lib/prisma'
import { jamaicaDateTime, jamaicaToday } from '@/lib/pricing'
import type { TxClient } from '@/lib/wallet-pay'

export interface SlotState {
  time: string
  /** Null = no capacity listed (unlimited). */
  capacity: number | null
  booked: number
  left: number | null
  soldOut: boolean
  /** Already started today, Jamaica time. */
  past: boolean
  closed: boolean
}

const keyOf = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Jamaica' })

export async function slotStates(experienceId: string, date: string, db: TxClient = prisma): Promise<SlotState[]> {
  const exp = await db.experience.findUnique({ where: { id: experienceId }, select: { startTimes: true, capacityPerSlot: true } })
  if (!exp) return []
  const dayStart = jamaicaDateTime(date, '00:00')
  if (!dayStart) return []
  const [bookings, overrides] = await Promise.all([
    db.booking.findMany({
      where: { experienceId, status: { not: 'CANCELLED' }, date: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400000) } },
      select: { time: true, partySize: true, date: true }
    }),
    db.experienceSlot.findMany({ where: { experienceId, date } })
  ])
  const now = Date.now()
  return exp.startTimes.map(time => {
    const override = overrides.find(o => o.time === time)
    const capacity = override?.capacity ?? exp.capacityPerSlot ?? null
    const booked = bookings.filter(b => b.time === time && keyOf(b.date) === date).reduce((n, b) => n + b.partySize, 0)
    const left = capacity === null ? null : Math.max(0, capacity - booked)
    const start = jamaicaDateTime(date, time)
    const past = Boolean(start && start.getTime() <= now)
    const closed = Boolean(override?.closed)
    return { time, capacity, booked, left, soldOut: closed || left === 0, past, closed }
  })
}

export class SlotError extends Error {}

/**
 * Throws SlotError when `party` more people can't take that slot. Call inside
 * the booking transaction so two bookings can't both take the last spots.
 */
export async function assertSlotAvailable(db: TxClient, experienceId: string, date: string, time: string | null, party: number, ignoreBookingId?: string) {
  if (!time) return
  if (date < jamaicaToday()) throw new SlotError('That date has passed')
  const states = await slotStates(experienceId, date, db)
  if (!states.length) return // experience lists no fixed times
  const slot = states.find(s => s.time === time)
  if (!slot) throw new SlotError('Pick one of the listed start times')
  if (slot.past) throw new SlotError('That start time has already passed — pick a later one')
  if (slot.closed) throw new SlotError('That time is closed — pick another')
  if (slot.left === null) return
  let left = slot.left
  if (ignoreBookingId) {
    const own = await db.booking.findUnique({ where: { id: ignoreBookingId }, select: { partySize: true, time: true, date: true } })
    if (own && own.time === time && keyOf(own.date) === date) left += own.partySize
  }
  if (left < party) throw new SlotError(left === 0 ? 'Sold out — pick another time' : `Only ${left} ${left === 1 ? 'spot' : 'spots'} left at that time`)
}
