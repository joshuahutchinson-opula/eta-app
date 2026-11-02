// lib/plan.ts — the Experiences "Plan my day" answers, their defaults, and the
// small derived bits Results shows (option badges, the "why this fits" line).
// Client-safe: only types come from the server-side generator.
import type { GeneratedBundle, TimeBudget } from '@/lib/experience-generator'
import type { DictKey } from '@/lib/i18n'

export type { TimeBudget }
export type Transport = 'walk' | 'drive' | 'handled'

export interface PlanMood { id: string; name: string }

/** A mood collection from /api/moods. */
export interface MoodItem {
  id: string
  name: string
  icon: string
  description: string
  coverImage: string
  videoUrl?: string | null
}
export interface PlanAnchor { type: 'vendor' | 'photospot'; id: string; name: string }

export interface PlanInput {
  mood: PlanMood | null
  time: TimeBudget
  crew: number
  transport: Transport
  /** "Plan around it" from Discover: the routes start here. */
  anchor: PlanAnchor | null
}

export const TIMES: Array<{ id: TimeBudget; label: DictKey }> = [
  { id: '2hr', label: 'm.qp.time.2hr' },
  { id: 'half', label: 'm.qp.time.half' },
  { id: 'full', label: 'm.qp.time.full' },
  { id: 'night', label: 'm.qp.time.night' }
]

export const TRANSPORTS: Array<{ id: Transport; label: DictKey }> = [
  { id: 'walk', label: 'm.qp.go.walk' },
  { id: 'drive', label: 'm.qp.go.drive' },
  { id: 'handled', label: 'm.qp.go.handled' }
]

export const MAX_CREW = 12

function jamaicaHour(now = new Date()): number {
  return new Date(now.getTime() - 5 * 3600000).getUTCHours()
}

/** Evenings default to a night out; otherwise half a day. */
export function defaultTime(now = new Date()): TimeBudget {
  return jamaicaHour(now) >= 17 ? 'night' : 'half'
}

export function defaultPlan(mood: PlanMood | null = null): PlanInput {
  return { mood, time: defaultTime(), crew: 1, transport: 'handled', anchor: null }
}

/** The generator request body for a plan. */
export function generateBody(plan: PlanInput, city: string) {
  return {
    mood: plan.mood?.id,
    time: plan.time,
    crewSize: plan.crew,
    transport: plan.transport,
    city,
    anchor: plan.anchor ? { type: plan.anchor.type, id: plan.anchor.id } : undefined
  }
}

export type OptionBadge = 'best' | 'local' | 'splurge'
export const BADGE_LABEL: Record<OptionBadge, DictKey> = { best: 'm.res.badge.best', local: 'm.res.badge.local', splurge: 'm.res.badge.splurge' }

/**
 * Labels for the options, derived from what they are: the priciest is the
 * Splurge (only when it really costs more), the one with the biggest share
 * of local spots (cook shops, jerk centres, street food) is Most local, and
 * the first remaining one is Best match.
 * `local` is null when an option has no stop data.
 */
export function optionBadges(options: Array<{ price: number; local: number | null }>): Array<OptionBadge | null> {
  const badges: Array<OptionBadge | null> = options.map(() => null)
  if (options.length === 0) return badges
  const taken = new Set<number>()
  if (options.length > 1) {
    const prices = options.map(o => o.price)
    const max = Math.max(...prices)
    const min = Math.min(...prices)
    const top = prices.indexOf(max)
    if (max > 0 && max >= min * 1.25 && prices.filter(p => p === max).length === 1) { badges[top] = 'splurge'; taken.add(top) }
    let local = -1
    options.forEach((o, i) => {
      if (taken.has(i) || o.local === null) return
      if (local === -1 || o.local > (options[local].local ?? -1)) local = i
    })
    const localValues = options.map(o => o.local).filter((x): x is number => x !== null)
    if (local !== -1 && localValues.length > 1 && Math.max(...localValues) > Math.min(...localValues)) { badges[local] = 'local'; taken.add(local) }
  }
  const best = options.findIndex((_, i) => !taken.has(i))
  if (best !== -1) badges[best] = 'best'
  return badges
}

/** Share of a generated route's stops that are local spots: cook shops, jerk centres, street food. */
export function localShare(b: GeneratedBundle): number {
  return b.stops.length ? b.stops.filter(s => s.localSpot).length / b.stops.length : 0
}

type T = (key: DictKey, vars?: Record<string, string | number>) => string

/** One honest line on why a generated route fits the answers. */
export function whyItFits(b: GeneratedBundle, plan: PlanInput, t: T): string {
  const allWalking = b.stops.length > 1 && b.stops.slice(0, -1).every(s => s.transportModeToNext === 'WALKING')
  if (plan.anchor && b.stops[0]?.id === plan.anchor.id) return t('m.res.why.anchor', { place: plan.anchor.name })
  if (b.sunset) return t('m.res.why.sunset', { place: b.stops[b.stops.length - 1]?.name ?? '' })
  if (plan.transport === 'walk' && allWalking) return t('m.res.why.walk')
  if (plan.time === 'night') return t('m.res.why.night', { time: b.stops[0]?.arrival ?? '' })
  if (plan.transport === 'handled' && b.stops.some(s => s.transportModeToNext === 'TAXI')) return t('m.res.why.rides')
  if (plan.mood) return t('m.res.why.mood', { mood: plan.mood.name, n: b.stops.length })
  return t('m.res.why.stops', { n: b.stops.length })
}

/** "4.5h" / "45 min". */
export function shortDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null
  if (minutes < 90) return `${Math.round(minutes / 5) * 5} min`
  return `${Math.round(minutes / 30) / 2}h`
}
