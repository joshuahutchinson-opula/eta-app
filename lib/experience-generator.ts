// lib/experience-generator.ts — builds multi-stop experience options from the
// real vendors and photo spots at request time.
//
// Rule-based: survey answers (moods, time budget, crew, budget tier, occasion,
// city, transport preference) turn into a score for every candidate stop; a
// route is grown one stop at a time by weighted random choice, favoring nearby,
// well-matched places and varying categories, so the same answers give a fresh
// set of options on each run. Travel between stops is timed with OSRM (see
// lib/routing.ts), falling back to a straight-line estimate.

import { prisma } from '@/lib/prisma'
import { legBetween, haversineKm, MAX_WALK_KM, type TransportMode } from '@/lib/routing'
import { priceTier } from '@/lib/vendor-style'

export type TimeBudget = '2hr' | 'half' | 'full' | 'night'

export interface GeneratorInput {
  /** Mood ids or names from the survey. */
  moods: string[]
  time: TimeBudget
  crewSize: number
  /** 1-4, matching the $ tiers. Omit for no cap. */
  budget?: number
  occasion?: string
  city?: 'NEGRIL' | 'MONTEGO_BAY'
  transport?: 'drive' | 'walk' | 'handled'
}

export interface GeneratedStop {
  order: number
  type: 'vendor' | 'photospot'
  id: string
  name: string
  category: string | null
  image: string | null
  neighborhood: string | null
  lat: number
  lng: number
  plannedDuration: number
  /** "7:30 pm" — when you'd arrive if the route starts on time. */
  arrival: string
  transportModeToNext: TransportMode | null
  transportDurationToNext: number | null
}

/** Same shape the Experiences results screen renders. */
export interface GeneratedBundle {
  id: string
  title: string
  moodTags: string[]
  meta: string
  /** Estimated per person, USD. */
  price: number
  pts: number
  hero: string
  city: 'NEGRIL' | 'MONTEGO_BAY'
  totalMinutes: number
  stops: GeneratedStop[]
  /** Whether travel times came from OSRM or the straight-line fallback. */
  routing: 'osrm' | 'estimate' | 'mixed'
}

type Category = 'FOOD' | 'DRINKS' | 'ACTIVITY' | 'WELLNESS' | 'BEACH' | 'OTHER'

interface MoodProfile {
  categories: Partial<Record<Category, number>>
  /** Weight for photo spots; 0 leaves them out. */
  spots: number
  spotTimes?: string[]
  keywords: string[]
  /** Pull toward cheaper (-1) or pricier (+1) places. */
  tierBias?: -1 | 1
  titles: string[]
}

// Keyed by the seeded mood names; icons are the fallback for renamed moods.
const MOOD_PROFILES: Record<string, MoodProfile> = {
  'R&R': { categories: { WELLNESS: 3, BEACH: 2, FOOD: 1 }, spots: 1.5, keywords: ['spa', 'massage', 'beach', 'relax', 'calm', 'yoga'], titles: ['Slow day, no alarms', 'Easy like Sunday', 'Recharge route'] },
  'Just The Two Of Us': { categories: { FOOD: 3, DRINKS: 2, WELLNESS: 1 }, spots: 2, spotTimes: ['Sunset', 'Golden Hour'], keywords: ['romantic', 'sunset', 'view', 'cliff', 'fine', 'lobster', 'private'], tierBias: 1, titles: ['Just the two of you', 'Date on the cliffs', 'Sunset for two'] },
  'Out Til Sunrise': { categories: { DRINKS: 3, FOOD: 1 }, spots: 0, keywords: ['party', 'dj', 'music', 'night', 'live', 'dance'], titles: ['Out til sunrise', 'Night shift', 'Last one standing'] },
  'Golden Hour': { categories: { DRINKS: 2, FOOD: 2 }, spots: 3, spotTimes: ['Sunset', 'Golden Hour'], keywords: ['sunset', 'cliff', 'view', 'west end'], titles: ['Chasing the sun', 'Golden hour run', 'Sunset circuit'] },
  'Water Life': { categories: { ACTIVITY: 3, BEACH: 2 }, spots: 2, keywords: ['snorkel', 'boat', 'dive', 'cliff', 'jump', 'water', 'sail', 'kayak', 'reef'], titles: ['Salt water all day', 'Reef, rock and rum', 'In the water'] },
  'Street Food Crawl': { categories: { FOOD: 4 }, spots: 0.5, keywords: ['jerk', 'patties', 'patty', 'street', 'stand', 'cook shop', 'local'], tierBias: -1, titles: ['Jerk trail', 'Street food crawl', 'Belly full route'] },
  'Hangover Cures': { categories: { FOOD: 2, WELLNESS: 2, BEACH: 2 }, spots: 0.5, keywords: ['juice', 'breakfast', 'natural', 'coconut', 'veggie', 'massage'], titles: ['The recovery', 'Hangover cure', 'Reset button'] },
  'Solo Missions': { categories: { ACTIVITY: 2, FOOD: 1, OTHER: 2 }, spots: 2, keywords: ['culture', 'tour', 'market', 'local', 'craft', 'history'], titles: ['Solo mission', 'Lone explorer', 'Your own pace'] },
  'Family Day': { categories: { BEACH: 3, ACTIVITY: 2, FOOD: 1 }, spots: 1, keywords: ['family', 'kids', 'park', 'water', 'beach', 'glass bottom'], titles: ['Family day out', 'All ages, all day', 'Beach crew'] },
  'Rum & Bass': { categories: { DRINKS: 4, FOOD: 1 }, spots: 0.3, keywords: ['rum', 'bar', 'music', 'sound', 'reggae', 'live'], titles: ['Rum & bass', 'Bar hop, bass drop', 'Sound system night'] }
}

const ICON_FALLBACK: Record<string, string> = {
  wellness: 'R&R', spa: 'R&R', sparkle: 'Just The Two Of Us', heart: 'Just The Two Of Us', moon: 'Out Til Sunrise',
  sun: 'Golden Hour', activity: 'Water Life', wave: 'Water Life', food: 'Street Food Crawl', user: 'Solo Missions',
  users: 'Family Day', drink: 'Rum & Bass', glass: 'Rum & Bass'
}

const OCCASION_BOOST: Record<string, Partial<Record<Category, number>> & { spots?: number; tier?: number }> = {
  date: { FOOD: 1.5, DRINKS: 1.3, spots: 1.3, tier: 1 },
  anniversary: { FOOD: 1.6, DRINKS: 1.3, spots: 1.4, tier: 1 },
  birthday: { DRINKS: 1.6, FOOD: 1.3 },
  celebration: { DRINKS: 1.6, FOOD: 1.3 },
  family: { BEACH: 1.6, ACTIVITY: 1.4, DRINKS: 0.4 },
  solo: { OTHER: 1.5, ACTIVITY: 1.3, spots: 1.3 },
  friends: { DRINKS: 1.3, ACTIVITY: 1.3 }
}

const TIME_PLAN: Record<TimeBudget, { stops: [number, number]; minutes: number; startHour: number }> = {
  '2hr': { stops: [2, 2], minutes: 180, startHour: -1 },
  half: { stops: [3, 3], minutes: 300, startHour: 10 },
  full: { stops: [4, 5], minutes: 540, startHour: 9 },
  night: { stops: [3, 4], minutes: 360, startHour: 19 }
}

const DEFAULT_MINUTES: Record<string, number> = { FOOD: 75, DRINKS: 60, ACTIVITY: 120, WELLNESS: 90, BEACH: 120, OTHER: 45, SPOT: 30 }

// Rough per-person spend by $ tier — used for the estimate, not charged.
const TIER_SPEND: Record<string, [number, number, number, number]> = {
  FOOD: [12, 25, 45, 80], DRINKS: [10, 18, 30, 50], ACTIVITY: [30, 60, 100, 160],
  WELLNESS: [40, 80, 120, 180], BEACH: [10, 20, 40, 60], OTHER: [10, 20, 30, 40]
}

// Same points a Discovery awards: vendor 50, photo spot 30.
const POINTS = { vendor: 50, photospot: 30 }

interface Candidate {
  type: 'vendor' | 'photospot'
  id: string
  name: string
  category: Category | null
  image: string | null
  neighborhood: string | null
  lat: number
  lng: number
  tier: number
  score: number
}

function weightedPick<T>(items: T[], weight: (t: T) => number): T | null {
  const weights = items.map(i => Math.max(0, weight(i)))
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return null
  let r = Math.random() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r <= 0) return items[i]
  }
  return items[items.length - 1]
}

function clockLabel(minutesFromMidnight: number): string {
  const m = ((Math.round(minutesFromMidnight / 5) * 5) % 1440 + 1440) % 1440
  const h = Math.floor(m / 60)
  const mm = m % 60
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

function jamaicaNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: 'numeric', hour12: false, timeZone: 'America/Jamaica' }).formatToParts(new Date())
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 12) % 24
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

async function loadCandidates(input: GeneratorInput, profiles: MoodProfile[]) {
  const city = input.city ?? 'NEGRIL'
  const [vendors, spots] = await Promise.all([
    prisma.vendor.findMany({
      where: { city, visibleInMarketplace: true, visibleOnMap: true, isTransport: false, category: { notIn: ['TRANSPORT', 'ACCOMMODATION'] } },
      select: { id: true, name: true, category: true, description: true, neighborhood: true, images: true, lat: true, lng: true, priceRange: true, isPremium: true, live: true, reviews: { select: { rating: true } } }
    }),
    // Only spots with real media — the curated set, not placeholder rows.
    prisma.photoSpot.findMany({ where: { city, gallery: { isEmpty: false } }, select: { id: true, name: true, description: true, officialPhoto: true, bestTime: true, lat: true, lng: true } })
  ])

  const occasion = OCCASION_BOOST[(input.occasion ?? '').toLowerCase()] ?? {}
  const night = input.time === 'night'
  const keywords = profiles.flatMap(p => p.keywords)
  const tierBias = profiles.reduce((b, p) => b + (p.tierBias ?? 0), 0) + (occasion.tier ?? 0)

  const vendorCands: Candidate[] = vendors.map(v => {
    const cat = v.category as Category
    let score = profiles.reduce((s, p) => s + (p.categories[cat] ?? 0), 0)
    if (score === 0) score = 0.15 // off-mood places stay possible, just unlikely
    const text = `${v.name} ${v.description}`.toLowerCase()
    const hits = keywords.filter(k => text.includes(k)).length
    score *= 1 + Math.min(hits, 3) * 0.4
    const ratings = v.reviews.map(r => r.rating)
    if (ratings.length) score *= 1 + ((ratings.reduce((a, b) => a + b, 0) / ratings.length) - 3) * 0.15
    if (v.isPremium) score *= 1.2
    if (v.live) score *= 1.15
    score *= (occasion as Record<string, number>)[cat] ?? 1
    const tier = priceTier(v.priceRange)
    if (tierBias > 0) score *= 1 + (tier - 2) * 0.25
    if (tierBias < 0) score *= 1 + (2 - tier) * 0.3
    if (night && (cat === 'BEACH' || cat === 'WELLNESS' || cat === 'ACTIVITY')) score *= 0.2
    return { type: 'vendor', id: v.id, name: v.name, category: cat, image: v.images[0] ?? null, neighborhood: v.neighborhood, lat: v.lat, lng: v.lng, tier, score }
  })

  const spotWeight = profiles.reduce((s, p) => s + p.spots, 0) / Math.max(1, profiles.length) * (occasion.spots ?? 1)
  const spotTimes = profiles.flatMap(p => p.spotTimes ?? [])
  const spotCands: Candidate[] = spotWeight <= 0 ? [] : spots.map(s => {
    let score = spotWeight
    if (spotTimes.length && spotTimes.includes(s.bestTime)) score *= 1.6
    if (night && !['Sunset', 'Golden Hour'].includes(s.bestTime)) score = 0
    return { type: 'photospot', id: s.id, name: s.name, category: null, image: s.officialPhoto, neighborhood: null, lat: s.lat, lng: s.lng, tier: 1, score }
  })

  // Budget: drop places above the tier cap, unless that leaves too few to route.
  let pool = [...vendorCands, ...spotCands].filter(c => c.score > 0)
  if (input.budget) {
    const capped = pool.filter(c => c.type === 'photospot' || c.tier <= input.budget!)
    if (capped.filter(c => c.type === 'vendor').length >= 4) pool = capped
  }
  return pool
}

/** Grow one route by weighted random choice; `used` damps places earlier options already picked. */
function assembleRoute(pool: Candidate[], input: GeneratorInput, used: Map<string, number>, usedStarts: Set<string>, repeatPenalty: number): Candidate[] | null {
  const plan = TIME_PLAN[input.time]
  const target = plan.stops[0] + Math.floor(Math.random() * (plan.stops[1] - plan.stops[0] + 1))
  const walk = input.transport === 'walk'
  const damp = (c: Candidate) => Math.pow(0.25, used.get(c.id) ?? 0)

  const start = weightedPick(pool, c => c.score * damp(c) * (usedStarts.has(c.id) ? 0.05 : 1))
  if (!start) return null
  const route = [start]
  const maxSpots = Math.max(1, Math.floor(target / 2))

  while (route.length < target) {
    const last = route[route.length - 1]
    const spotsSoFar = route.filter(r => r.type === 'photospot').length
    const hasEat = route.some(r => r.category === 'FOOD' || r.category === 'DRINKS')
    const lastPick = route.length === target - 1
    let options = pool.filter(c => !route.some(r => r.id === c.id))
    if (spotsSoFar >= maxSpots) options = options.filter(c => c.type !== 'photospot')
    // Half and full days always include somewhere to eat or drink.
    if (lastPick && !hasEat && input.time !== '2hr') {
      const eat = options.filter(c => c.category === 'FOOD' || c.category === 'DRINKS')
      if (eat.length) options = eat
    }
    const next = weightedPick(options, c => {
      const km = haversineKm(last, c)
      if (km > 25) return 0
      let w = c.score * damp(c) / Math.pow(1 + km, 1.5)
      if (walk && km > MAX_WALK_KM) w *= 0.05
      // Vary the day: each earlier stop of the same category makes another less likely.
      if (c.category) w *= Math.pow(repeatPenalty, route.filter(r => r.category === c.category).length)
      if (c.type === 'photospot' && last.type === 'photospot') w *= 0.3
      return w
    })
    if (!next) break
    route.push(next)
  }
  return route.length >= 2 ? route : null
}

function isIslandSpot(c: Candidate) {
  return c.type === 'photospot' && /\bcay\b/i.test(c.name)
}

async function toBundle(route: Candidate[], input: GeneratorInput, profiles: MoodProfile[], moodNames: string[]): Promise<GeneratedBundle> {
  const plan = TIME_PLAN[input.time]
  const legs = await Promise.all(route.slice(0, -1).map((c, i) => {
    const next = route[i + 1]
    const boat = isIslandSpot(c) || isIslandSpot(next)
    return legBetween(c, next, { mode: boat ? 'BOAT' : undefined, preferWalking: input.transport === 'walk' })
  }))

  // Fit time at stops to the budget (travel is fixed), never below 20 minutes a stop.
  const travel = legs.reduce((m, l) => m + l.minutes, 0)
  const wanted = route.map(c => DEFAULT_MINUTES[c.type === 'photospot' ? 'SPOT' : c.category ?? 'OTHER'])
  const room = Math.max(route.length * 20, plan.minutes - travel)
  const scale = Math.min(1.25, room / wanted.reduce((a, b) => a + b, 0))
  const durations = wanted.map(w => Math.max(20, Math.round(w * scale / 5) * 5))

  // Sunset moods on short plans are timed to finish around sunset (~6:45 pm in Negril).
  const chasesSunset = profiles.some(p => p.spotTimes?.includes('Sunset')) && (input.time === '2hr' || input.time === 'half')
  const startAt = chasesSunset
    ? 18 * 60 + 45 - plan.minutes
    : plan.startHour >= 0 ? plan.startHour * 60 : Math.ceil((jamaicaNowMinutes() + 30) / 15) * 15
  let clock = startAt
  const stops: GeneratedStop[] = route.map((c, i) => {
    const arrival = clockLabel(clock)
    clock += durations[i] + (legs[i]?.minutes ?? 0)
    return {
      order: i,
      type: c.type,
      id: c.id,
      name: c.name,
      category: c.category,
      image: c.image,
      neighborhood: c.neighborhood,
      lat: c.lat,
      lng: c.lng,
      plannedDuration: durations[i],
      arrival,
      transportModeToNext: legs[i]?.mode ?? null,
      transportDurationToNext: legs[i]?.minutes ?? null
    }
  })

  const crew = Math.max(1, input.crewSize)
  const spend = route.reduce((sum, c) => sum + (c.type === 'vendor' && c.category ? TIER_SPEND[c.category]?.[c.tier - 1] ?? 20 : 0), 0)
  // A taxi seats four; the fare is split across the crew. Boats are per person.
  const cars = Math.ceil(crew / 4)
  const rides = legs.reduce((sum, l) => sum + (l.mode === 'TAXI' && input.transport !== 'drive' ? (8 + l.minutes * 1.2) * cars / crew : l.mode === 'BOAT' ? 25 : 0), 0)
  const totalMinutes = clock - startAt
  const sources = new Set(legs.map(l => l.source))
  const profile = profiles[Math.floor(Math.random() * profiles.length)]
  const hours = totalMinutes / 60
  const area = route[0].neighborhood ?? route[0].name

  return {
    id: `gen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    title: profile.titles[Math.floor(Math.random() * profile.titles.length)],
    moodTags: moodNames,
    meta: `${stops.length} stops · ${hours < 1.5 ? `${Math.round(totalMinutes)} min` : `${Math.round(hours * 2) / 2} hrs`} · starts ${stops[0].arrival} near ${area}`,
    price: Math.round(spend + rides),
    pts: route.reduce((p, c) => p + POINTS[c.type], 0),
    hero: route.find(c => c.type === 'photospot' && c.image)?.image ?? route.find(c => c.image)?.image ?? '',
    city: input.city ?? 'NEGRIL',
    totalMinutes,
    stops,
    routing: sources.size === 0 ? 'estimate' : sources.size > 1 ? 'mixed' : (Array.from(sources)[0] as 'osrm' | 'estimate')
  }
}

/** Three different route options for the survey answers. */
export async function generateBundles(input: GeneratorInput, count = 3): Promise<GeneratedBundle[]> {
  const moods = input.moods.length
    ? await prisma.mood.findMany({ where: { OR: [{ id: { in: input.moods } }, { name: { in: input.moods } }] }, select: { name: true, icon: true } })
    : []
  const profiles = moods
    .map(m => MOOD_PROFILES[m.name] ?? MOOD_PROFILES[ICON_FALLBACK[m.icon] ?? ''])
    .filter((p): p is MoodProfile => Boolean(p))
  const active = profiles.length ? profiles : [MOOD_PROFILES['Golden Hour'], MOOD_PROFILES['Street Food Crawl']]
  const moodNames = moods.map(m => m.name)

  const pool = await loadCandidates(input, active)
  // A food crawl is meant to be all food; everything else mixes categories.
  const repeatPenalty = active.some(p => (p.categories.FOOD ?? 0) >= 4) ? 0.9 : 0.35
  const used = new Map<string, number>()
  const usedStarts = new Set<string>()
  const routes: Candidate[][] = []
  const seen = new Set<string>()
  for (let attempt = 0; attempt < count * 4 && routes.length < count; attempt++) {
    const route = assembleRoute(pool, input, used, usedStarts, repeatPenalty)
    if (!route) continue
    const key = route.map(r => r.id).sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    routes.push(route)
    usedStarts.add(route[0].id)
    for (const r of route) used.set(r.id, (used.get(r.id) ?? 0) + 1)
  }
  return Promise.all(routes.map(r => toBundle(r, input, active, moodNames)))
}
