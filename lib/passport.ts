// lib/passport.ts — "My Discoveries": every place the user has checked in
// at or discovered, counts by category, check-in streaks and badges. All
// computed from real CheckIn and Discovery rows.
import { prisma } from '@/lib/prisma'

const OFFSET = 5 * 3600000
const dayKey = (d: Date) => new Date(d.getTime() - OFFSET).toISOString().slice(0, 10)

export interface PassportPlace { kind: 'vendor' | 'photospot' | 'gem'; id: string; name: string; lat: number; lng: number; category: string | null; city: string | null; firstAt: string }
export interface Badge { key: string; earned: boolean; progress: number; target: number }

/** Consecutive Jamaica days with a check-in, ending today (or yesterday, so a streak survives until tonight). */
export function streaks(days: Set<string>, now = new Date()): { current: number; best: number } {
  const sorted = Array.from(days).sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    run = prev && Date.parse(d) - Date.parse(prev) === 86400000 ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  let current = 0
  const today = dayKey(now)
  const yesterday = dayKey(new Date(now.getTime() - 86400000))
  let cursor = days.has(today) ? today : days.has(yesterday) ? yesterday : null
  while (cursor && days.has(cursor)) {
    current++
    cursor = new Date(Date.parse(cursor) - 86400000).toISOString().slice(0, 10)
  }
  return { current, best }
}

export async function passportFor(userId: string) {
  const [discoveries, checkIns] = await Promise.all([
    prisma.discovery.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        vendor: { select: { id: true, name: true, lat: true, lng: true, category: true, city: true } },
        photoSpot: { select: { id: true, name: true, lat: true, lng: true, city: true } },
        hiddenGem: { select: { id: true, name: true, lat: true, lng: true, category: true } }
      }
    }),
    prisma.checkIn.findMany({ where: { userId }, select: { createdAt: true, vendorId: true, photoSpotId: true } })
  ])

  const places = new Map<string, PassportPlace>()
  for (const d of discoveries) {
    const at = d.createdAt.toISOString()
    if (d.vendor && !places.has(`v${d.vendor.id}`)) places.set(`v${d.vendor.id}`, { kind: 'vendor', id: d.vendor.id, name: d.vendor.name, lat: d.vendor.lat, lng: d.vendor.lng, category: d.vendor.category, city: d.vendor.city, firstAt: at })
    if (d.photoSpot && !places.has(`p${d.photoSpot.id}`)) places.set(`p${d.photoSpot.id}`, { kind: 'photospot', id: d.photoSpot.id, name: d.photoSpot.name, lat: d.photoSpot.lat, lng: d.photoSpot.lng, category: null, city: d.photoSpot.city, firstAt: at })
    if (d.hiddenGem && !places.has(`g${d.hiddenGem.id}`)) places.set(`g${d.hiddenGem.id}`, { kind: 'gem', id: d.hiddenGem.id, name: d.hiddenGem.name, lat: d.hiddenGem.lat, lng: d.hiddenGem.lng, category: d.hiddenGem.category, city: null, firstAt: at })
  }
  const list = Array.from(places.values())
  const byCategory: Record<string, number> = {}
  for (const p of list) if (p.kind === 'vendor' && p.category) byCategory[p.category] = (byCategory[p.category] ?? 0) + 1
  const photoSpots = list.filter(p => p.kind === 'photospot').length
  const gems = list.filter(p => p.kind === 'gem').length
  const towns = new Set(list.map(p => p.city).filter(Boolean)).size
  const { current, best } = streaks(new Set(checkIns.map(c => dayKey(c.createdAt))))

  const badge = (key: string, progress: number, target: number): Badge => ({ key, earned: progress >= target, progress: Math.min(progress, target), target })
  const badges: Badge[] = [
    badge('firstCheckin', checkIns.length, 1),
    badge('beaches5', byCategory.BEACH ?? 0, 5),
    badge('food10', byCategory.FOOD ?? 0, 10),
    badge('firstGem', gems, 1),
    badge('photo5', photoSpots, 5),
    badge('streak7', best, 7),
    badge('places25', list.length, 25),
    badge('towns3', towns, 3)
  ]

  return { places: list, counts: { places: list.length, checkIns: checkIns.length, photoSpots, gems, towns, byCategory }, streak: current, bestStreak: best, badges }
}
