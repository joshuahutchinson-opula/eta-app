// lib/daypart.ts — "what time of day is it in <town>", from the real sun at
// the town's coordinates (suncalc). Shared by the server (Home's ordering,
// the Vibe feed) and the app (the living hero, the tagline).
//   morning    first light (30 min before sunrise) → solar noon
//   afternoon  solar noon → golden hour
//   golden     90 min before sunset → 30 min after it
//   night      the rest
// What leads each daypart (Featured, Choose The Vibe, the Vibe feed) is
// below: morning breakfast/beaches/coffee, afternoon lunch/water/activities,
// golden hour sunset spots/sundowners, night dinner/bars/parties.
import SunCalc from 'suncalc'

export type Daypart = 'morning' | 'afternoon' | 'golden' | 'night'
export const DAYPARTS: Daypart[] = ['morning', 'afternoon', 'golden', 'night']

const MIN = 60000
const GOLDEN_BEFORE = 90 * MIN
const GOLDEN_AFTER = 30 * MIN
const FIRST_LIGHT = 30 * MIN

export interface SunInfo {
  daypart: Daypart
  sunrise: Date
  sunset: Date
  solarNoon: Date
  goldenStart: Date
  goldenEnd: Date
  /** When the daypart next changes. */
  nextChange: Date
}

export function sunInfo(lat: number, lng: number, now: Date = new Date()): SunInfo {
  // suncalc's "day" is the UTC date; noon-anchor on the local (UTC-5) day so
  // the times are for today in Jamaica, not tomorrow after 7 pm.
  const local = new Date(now.getTime() - 5 * 3600000)
  const localNoon = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 17))
  const today = SunCalc.getTimes(localNoon, lat, lng)
  const tomorrow = SunCalc.getTimes(new Date(localNoon.getTime() + 86400000), lat, lng)
  const { sunrise, sunset, solarNoon } = today
  const goldenStart = new Date(sunset.getTime() - GOLDEN_BEFORE)
  const goldenEnd = new Date(sunset.getTime() + GOLDEN_AFTER)
  const firstLight = new Date(sunrise.getTime() - FIRST_LIGHT)
  const t = now.getTime()

  let daypart: Daypart
  let nextChange: Date
  if (t < firstLight.getTime()) { daypart = 'night'; nextChange = firstLight }
  else if (t < solarNoon.getTime()) { daypart = 'morning'; nextChange = solarNoon }
  else if (t < goldenStart.getTime()) { daypart = 'afternoon'; nextChange = goldenStart }
  else if (t < goldenEnd.getTime()) { daypart = 'golden'; nextChange = goldenEnd }
  else { daypart = 'night'; nextChange = new Date(tomorrow.sunrise.getTime() - FIRST_LIGHT) }

  return { daypart, sunrise, sunset, solarNoon, goldenStart, goldenEnd, nextChange }
}

// ---------- What leads each daypart ----------

interface Lean {
  /** Vendor categories that fit, with a weight. */
  categories: Partial<Record<string, number>>
  /** Words in a name/description that fit. */
  keywords: RegExp
  /** Mood names (Mood.name) that lead Choose The Vibe, in order. */
  moods: string[]
}

export const DAYPART_LEAN: Record<Daypart, Lean> = {
  morning: {
    categories: { FOOD: 2, BEACH: 3, WELLNESS: 2, ACTIVITY: 1 },
    keywords: /breakfast|coffee|caf[eé]|bakery|brunch|ackee|porridge|juice|smoothie|yoga|beach|sunrise/i,
    moods: ['Hangover Cures', 'R&R', 'Water Life', 'Family Day', 'Solo Missions']
  },
  afternoon: {
    categories: { FOOD: 2, ACTIVITY: 3, BEACH: 2, WELLNESS: 1 },
    keywords: /lunch|jerk|cook ?shop|patty|seafood|snorkel|dive|boat|catamaran|kayak|river|falls|tour|swim|water|beach/i,
    moods: ['Water Life', 'Street Food Crawl', 'Family Day', 'Solo Missions', 'R&R']
  },
  golden: {
    categories: { DRINKS: 3, FOOD: 1, BEACH: 2 },
    keywords: /sunset|sundown|cliff|rooftop|view|cocktail|rum|bar|lounge|happy hour|west end|golden/i,
    moods: ['Sunset Chaser', 'Golden Hour', 'Just The Two Of Us', 'Rum & Bass']
  },
  night: {
    categories: { FOOD: 2, DRINKS: 3 },
    keywords: /dinner|restaurant|grill|bar|club|party|reggae|live music|dj|sound ?system|lounge|night/i,
    moods: ['Party Time', 'Out Til Sunrise', 'Rum & Bass', 'Just The Two Of Us', 'Street Food Crawl']
  }
}

/** How well a place fits the daypart: 0 (not at all) and up. */
export function daypartScore(daypart: Daypart, p: { category?: string | null; name?: string | null; description?: string | null }): number {
  const lean = DAYPART_LEAN[daypart]
  const cat = (p.category && lean.categories[p.category]) || 0
  const text = `${p.name ?? ''} ${p.description ?? ''}`
  const hits = (text.match(new RegExp(lean.keywords.source, 'gi')) ?? []).length
  return cat + Math.min(hits, 3) * 2
}

/** Moods in Choose The Vibe order for the daypart: its leads first, then the rest as they were. */
export function orderMoods<T extends { name: string }>(daypart: Daypart, moods: T[]): T[] {
  const lead = DAYPART_LEAN[daypart].moods
  const rank = (m: T) => { const i = lead.indexOf(m.name); return i === -1 ? Infinity : i }
  return moods.map((m, i) => ({ m, i })).sort((a, b) => (rank(a.m) - rank(b.m)) || (a.i - b.i)).map(x => x.m)
}
