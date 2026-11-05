// lib/host-lean.ts — recommendations for guests of a partner property lean
// toward what the property doesn't offer (tours, nightlife, food crawls,
// beaches) and don't push rival restaurants at mealtimes. Pure functions,
// fed by the "At your stay" data (lib/at-stay.ts → covers, vendor ids).
import { moodCategories } from '@/lib/mood-profiles'

export interface HostContext {
  /** Vendor categories the property covers itself. */
  covers: string[]
  /** Its own linked vendors. */
  vendorIds: string[]
}

/** Breakfast, lunch and dinner, Jamaica time. */
export function isMealtime(now = new Date()): boolean {
  const h = new Date(now.getTime() - 5 * 3600000).getUTCHours()
  return (h >= 7 && h < 10) || (h >= 12 && h < 15) || (h >= 18 && h < 22)
}

/** Drops rival restaurants at mealtimes; puts what the property lacks first. Stable otherwise. */
export function leanVendors<T extends { id: string; category: string }>(list: T[], host: HostContext | null, now = new Date()): T[] {
  if (!host) return list
  const meal = isMealtime(now) && host.covers.includes('FOOD')
  const kept = list.filter(v => !(meal && v.category === 'FOOD' && !host.vendorIds.includes(v.id)))
  const lacks = (v: T) => (host.covers.includes(v.category) ? 1 : 0)
  return kept.map((v, i) => ({ v, i })).sort((a, b) => lacks(a.v) - lacks(b.v) || a.i - b.i).map(x => x.v)
}

/** Experiences built around what the property doesn't offer come first. */
export function leanExperiences<T extends { moods?: Array<{ name: string; icon?: string }> }>(list: T[], host: HostContext | null): T[] {
  if (!host) return list
  const fresh = (e: T) => {
    const cats = (e.moods ?? []).flatMap(m => moodCategories(m.name, m.icon ?? ''))
    return cats.some(c => !host.covers.includes(c)) ? 0 : 1
  }
  return list.map((e, i) => ({ e, i })).sort((a, b) => fresh(a.e) - fresh(b.e) || a.i - b.i).map(x => x.e)
}
