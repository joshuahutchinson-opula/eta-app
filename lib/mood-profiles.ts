// lib/mood-profiles.ts — what each mood means in vendor terms. Pure data,
// so both the route generator (server) and the vibe filters on Home and
// Market (client) map a mood to vendor categories the same way.

export type Category = 'FOOD' | 'DRINKS' | 'ACTIVITY' | 'WELLNESS' | 'BEACH' | 'OTHER'

export interface MoodProfile {
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
export const MOOD_PROFILES: Record<string, MoodProfile> = {
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

export const ICON_FALLBACK: Record<string, string> = {
  wellness: 'R&R', spa: 'R&R', sparkle: 'Just The Two Of Us', heart: 'Just The Two Of Us', moon: 'Out Til Sunrise',
  sun: 'Golden Hour', activity: 'Water Life', wave: 'Water Life', food: 'Street Food Crawl', user: 'Solo Missions',
  users: 'Family Day', drink: 'Rum & Bass', glass: 'Rum & Bass'
}

// Home shows two moods under friendlier names.
const DISPLAY_ALIASES: Record<string, string> = { 'Party Time': 'Out Til Sunrise', 'Sunset Chaser': 'Golden Hour' }

export function moodProfile(name: string, icon?: string): MoodProfile | null {
  return MOOD_PROFILES[DISPLAY_ALIASES[name] ?? name] ?? (icon ? MOOD_PROFILES[ICON_FALLBACK[icon] ?? ''] : undefined) ?? null
}

/** The vendor categories a mood is really about (its weight-2+ categories). */
export function moodCategories(name: string, icon?: string): string[] {
  const p = moodProfile(name, icon)
  if (!p) return []
  return Object.entries(p.categories).filter(([, w]) => (w ?? 0) >= 2).map(([c]) => c)
}
