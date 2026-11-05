// lib/plan-b.ts — Plan B: when rain is forecast for a booked outdoor
// experience, offer a one-tap swap to an indoor one in the same town, same
// day, around the same time, for the same party. Swaps only go to options
// that cost the same or less; any difference goes back to the wallet.
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { rainChance } from '@/lib/weather'
import { priceBreakdown, jamaicaDateTime } from '@/lib/pricing'
import { assertSlotAvailable, slotStates } from '@/lib/slots'
import type { CityCode } from '@/lib/regions'

/** Rain chance (%) at or above which Plan B is offered. */
export const PLAN_B_RAIN_THRESHOLD = 60
/** How far ahead bookings are checked; the forecast gets shaky after that. */
export const PLAN_B_LOOKAHEAD_MS = 3 * 86400000

const OUTDOOR_CATEGORIES = ['BEACH', 'ACTIVITY']

const EXPERIENCE_SELECT = {
  id: true, name: true, tagline: true, price: true, imageUrl: true, city: true, outdoor: true, startTimes: true,
  stops: { select: { stopType: true, plannedDuration: true, vendor: { select: { category: true } } } }
} as const

type ExperienceRow = Prisma.ExperienceGetPayload<{ select: typeof EXPERIENCE_SELECT }>

export function isOutdoor(e: Pick<ExperienceRow, 'outdoor' | 'stops'>): boolean {
  if (e.outdoor !== null && e.outdoor !== undefined) return e.outdoor
  return e.stops.some(s => s.stopType === 'PHOTO_SPOT' || OUTDOOR_CATEGORIES.includes(s.vendor?.category ?? ''))
}

const dayOf = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Jamaica' })
const timeOf = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Jamaica' })

export interface PlanBOption {
  id: string
  name: string
  tagline: string
  imageUrl: string
  price: number
  time: string | null
  /** Back to the wallet if they swap (USD). */
  refund: number
}

/** Indoor experiences that can take this booking's party on its day. */
async function alternatives(booking: { id: string; date: Date; time: string | null; partySize: number; totalPrice: number }, from: ExperienceRow): Promise<PlanBOption[]> {
  const date = dayOf(booking.date)
  const wanted = booking.time ?? timeOf(booking.date)
  const candidates = await prisma.experience.findMany({
    where: { city: from.city, id: { not: from.id }, price: { lte: from.price } },
    select: EXPERIENCE_SELECT,
    take: 40
  })
  const out: PlanBOption[] = []
  for (const e of candidates.filter(c => !isOutdoor(c))) {
    let time: string | null = null
    if (e.startTimes.length) {
      const open = (await slotStates(e.id, date)).filter(s => !s.past && !s.soldOut && (s.left === null || s.left >= booking.partySize))
      if (!open.length) continue
      const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
      time = open.sort((a, b) => Math.abs(mins(a.time) - mins(wanted)) - Math.abs(mins(b.time) - mins(wanted)))[0].time
    }
    const total = priceBreakdown(e.price, booking.partySize).total
    if (total > booking.totalPrice + 0.005) continue
    out.push({ id: e.id, name: e.name, tagline: e.tagline, imageUrl: e.imageUrl, price: e.price, time, refund: Math.round((booking.totalPrice - total) * 100) / 100 })
    if (out.length >= 3) break
  }
  return out
}

export interface PlanBOffer {
  booking: { id: string; date: string; time: string | null; partySize: number; experience: { id: string; name: string; imageUrl: string } }
  rainChance: number
  options: PlanBOption[]
}

/** The caller's upcoming outdoor bookings with rain forecast, each with indoor swaps. */
export async function planBOffers(userId: string, now = new Date()): Promise<PlanBOffer[]> {
  const bookings = await prisma.booking.findMany({
    where: { userId, status: 'CONFIRMED', experienceId: { not: null }, accommodationId: null, trip: null, date: { gt: now, lte: new Date(now.getTime() + PLAN_B_LOOKAHEAD_MS) } },
    include: { experience: { select: EXPERIENCE_SELECT } },
    orderBy: { date: 'asc' }
  })
  const offers: PlanBOffer[] = []
  for (const b of bookings) {
    const exp = b.experience
    if (!exp || !isOutdoor(exp)) continue
    const minutes = exp.stops.reduce((n, s) => n + s.plannedDuration, 0) || 180
    const chance = await rainChance(exp.city as CityCode, b.date, Math.max(1, Math.round(minutes / 60)))
    if (chance === null || chance < PLAN_B_RAIN_THRESHOLD) continue
    const options = await alternatives(b, exp)
    if (!options.length) continue
    offers.push({ booking: { id: b.id, date: b.date.toISOString(), time: b.time, partySize: b.partySize, experience: { id: exp.id, name: exp.name, imageUrl: exp.imageUrl } }, rainChance: chance, options })
  }
  return offers
}

export class PlanBError extends Error {}

/** Moves the booking to the indoor experience; refunds any difference to the wallet. */
export async function swapToPlanB(userId: string, bookingId: string, experienceId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { experience: { select: EXPERIENCE_SELECT }, trip: { select: { id: true } } } })
  if (!b || b.userId !== userId) throw new PlanBError('Nuttin nuh go suh')
  if (b.status !== 'CONFIRMED' || !b.experience || b.accommodationId || b.trip) throw new PlanBError('This booking can’t be swapped')
  const option = (await alternatives(b, b.experience)).find(o => o.id === experienceId)
  if (!option) throw new PlanBError('That option isn’t available any more — pick another')
  const date = dayOf(b.date)
  const start = option.time ? jamaicaDateTime(date, option.time) : b.date
  if (!start) throw new PlanBError('That option isn’t available any more — pick another')
  const price = priceBreakdown(option.price, b.partySize)

  return prisma.$transaction(async tx => {
    await assertSlotAvailable(tx, option.id, date, option.time, b.partySize, b.id)
    const done = await tx.booking.updateMany({
      where: { id: b.id, status: 'CONFIRMED', experienceId: b.experienceId },
      data: { experienceId: option.id, date: start, time: option.time ?? b.time, unitPrice: option.price, fees: price.fees, totalPrice: price.total, rescheduledAt: new Date() }
    })
    if (!done.count) throw new PlanBError('This booking can’t be swapped')
    if (option.refund > 0) {
      await tx.user.update({ where: { id: userId }, data: { walletBalance: { increment: option.refund } } })
      await tx.transaction.create({ data: { userId, bookingId: b.id, amount: option.refund, type: 'REFUND', status: 'COMPLETED', rail: 'ETA Wallet', description: `Plan B: ${b.experience!.name} → ${option.name}` } })
    }
    return { booking: await tx.booking.findUniqueOrThrow({ where: { id: b.id } }), from: b.experience!.name, to: option.name, refund: option.refund }
  })
}
