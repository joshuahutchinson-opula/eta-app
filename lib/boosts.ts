// lib/boosts.ts — points boosts that stack on the base earn values
// (lib/earn-config.ts). Three kinds, all Boost rows:
//   quiet_hour  a vendor's 2× window (e.g. 2–5 pm), switched on/off in the
//               vendor app; shown on Rewards with a live countdown.
//   rainy_day   2× at indoor spots (Vendor.indoor) in a town when the
//               forecast says rain (lib/weather.ts) in the next 3 hours.
//   crew        +EARN.crewBonus each when a whole group (a travel trip or
//               crew) checks in at the same vendor within 30 minutes.
// Boost multipliers add base × (multiplier − 1) each, so they stack.
import { prisma } from '@/lib/prisma'
import { rainChance } from '@/lib/weather'
import { jamaicaDayKey } from '@/lib/trip-dates'
import { CREW_WINDOW_MS, EARN, RAIN_BOOST_CHANCE } from '@/lib/earn-config'
import type { CityCode } from '@/lib/regions'

export type BoostKind = 'quiet_hour' | 'rainy_day' | 'crew'
const KIND_ORDER: Record<BoostKind, number> = { quiet_hour: 0, rainy_day: 1, crew: 2 }

/** Jamaica (UTC−5, no DST) minutes since midnight and day of week. */
export function jamaicaClock(at = Date.now()): { minutes: number; dow: number } {
  const d = new Date(at - 5 * 3600000)
  return { minutes: d.getUTCHours() * 60 + d.getUTCMinutes(), dow: d.getUTCDay() }
}

interface BoostRow { kind: string; multiplier: number; startMin: number | null; endMin: number | null; days: number[] }

/** Running right now? (Within its window, on one of its days.) */
export function boostLive(b: BoostRow, at = Date.now()): boolean {
  const { minutes, dow } = jamaicaClock(at)
  if (b.days.length && !b.days.includes(dow)) return false
  if (b.startMin === null || b.endMin === null) return true
  return minutes >= b.startMin && minutes < b.endMin
}

/** Milliseconds until a live boost's window closes (for the countdown); null if it has no window. */
export function boostEndsIn(b: BoostRow, at = Date.now()): number | null {
  if (b.endMin === null) return null
  return Math.max(0, (b.endMin - jamaicaClock(at).minutes) * 60000)
}

/** Is rain forecast in the town in the next 3 hours? */
export async function rainyNow(city: CityCode): Promise<boolean> {
  const chance = await rainChance(city, new Date(), 3).catch(() => null)
  return chance !== null && chance >= RAIN_BOOST_CHANCE
}

export interface BoostLine { reason: 'boost_quiet_hour' | 'boost_rainy_day'; multiplier: number; boostId: string }

/** Which multipliers apply to an earn at this vendor right now (call outside a transaction: it may check the forecast). */
export async function boostsForVendor(vendor: { id: string; city: string; indoor: boolean }, at = Date.now()): Promise<BoostLine[]> {
  const rows = await prisma.boost.findMany({
    where: { active: true, OR: [{ kind: 'quiet_hour', vendorId: vendor.id }, ...(vendor.indoor ? [{ kind: 'rainy_day', city: vendor.city as never }] : [])] }
  })
  const lines: BoostLine[] = []
  const quiet = rows.filter(r => r.kind === 'quiet_hour' && boostLive(r, at)).sort((a, b) => b.multiplier - a.multiplier)[0]
  if (quiet) lines.push({ reason: 'boost_quiet_hour', multiplier: quiet.multiplier, boostId: quiet.id })
  const rainy = rows.find(r => r.kind === 'rainy_day' && boostLive(r, at))
  if (rainy && await rainyNow(vendor.city as CityCode)) lines.push({ reason: 'boost_rainy_day', multiplier: rainy.multiplier, boostId: rainy.id })
  return lines
}

/** Today's boosts in a town, for the Rewards hub: live quiet hours (with end time), later ones today, and the rainy-day boost if it's raining. */
export async function todaysBoosts(city: CityCode, at = Date.now()) {
  const { minutes, dow } = jamaicaClock(at)
  const rows = await prisma.boost.findMany({
    where: { active: true, OR: [{ kind: 'quiet_hour', vendor: { city: city as never } }, { kind: { in: ['rainy_day', 'crew'] }, OR: [{ city: city as never }, { city: null }] }] },
    include: { vendor: { select: { id: true, name: true, images: true, indoor: true } } }
  })
  const raining = rows.some(r => r.kind === 'rainy_day') ? await rainyNow(city) : false
  return rows
    .filter(r => !r.days.length || r.days.includes(dow))
    .filter(r => r.kind !== 'quiet_hour' || (r.endMin ?? 1440) > minutes)
    .filter(r => r.kind !== 'rainy_day' || raining)
    .map(r => {
      const live = boostLive(r, at)
      return {
        id: r.id, kind: r.kind as BoostKind, title: r.title, multiplier: r.multiplier, bonus: r.kind === 'crew' ? (r.bonus || EARN.crewBonus) : 0,
        startMin: r.startMin, endMin: r.endMin, live,
        endsAt: live && r.endMin !== null ? new Date(at + (boostEndsIn(r, at) ?? 0)).toISOString() : null,
        vendor: r.vendor ? { id: r.vendor.id, name: r.vendor.name, imageUrl: r.vendor.images[0] ?? null } : null
      }
    })
    // Vendor quiet hours first (running ones, then later today), then rainy-day, then the always-on crew bonus.
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || Number(b.live) - Number(a.live) || (a.startMin ?? 0) - (b.startMin ?? 0))
}

/**
 * Crew bonus: if everyone in one of the caller's groups (a current travel
 * trip, or an active crew) has QR-checked in at this vendor in the last 30
 * minutes, each of them gets the bonus once (per vendor per day).
 * Returns the user ids that were paid (empty when the group isn't complete).
 */
export async function crewGroupsComplete(userId: string, vendorId: string, at = Date.now()): Promise<string[][]> {
  const now = new Date(at)
  const [trips, crews] = await Promise.all([
    prisma.travelTrip.findMany({
      where: { startDate: { lte: now }, endDate: { gte: new Date(at - 86400000) }, OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: { ownerId: true, members: { select: { userId: true } } }
    }),
    prisma.crewGroup.findMany({ where: { members: { some: { userId, isActive: true } } }, select: { members: { where: { isActive: true }, select: { userId: true } } } })
  ])
  const groups = [
    ...trips.map(t => Array.from(new Set([t.ownerId, ...t.members.map(m => m.userId)]))),
    ...crews.map(c => Array.from(new Set(c.members.map(m => m.userId))))
  ].filter(g => g.length >= 2)
  if (!groups.length) return []
  const since = new Date(at - CREW_WINDOW_MS)
  const here = new Set((await prisma.checkIn.findMany({
    where: { vendorId, method: 'qr', createdAt: { gte: since }, userId: { in: Array.from(new Set(groups.flat())) } },
    select: { userId: true }
  })).map(c => c.userId))
  return groups.filter(g => g.every(id => here.has(id)))
}

/** The crew bonus's ledger source: one per vendor per Jamaica day. */
export function crewSourceId(vendorId: string, at = Date.now()) {
  return `${vendorId}:${jamaicaDayKey(at)}`
}
