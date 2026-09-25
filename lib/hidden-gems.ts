// lib/hidden-gems.ts — rules for Hidden Gems on the Discover map.
//
// Fog of war is enforced here, on the server: a gem's name, photos and exact
// location are only sent to someone whose live position is within
// REVEAL_RADIUS_M of it (or to its submitter). Everyone else gets a coarse
// "something's hidden around here" cell, so the fog can't be lifted by
// reading the API response.
//
// Pending gems never show as fog — only their submitter sees them from afar —
// but anyone who walks within range can find and confirm them; that's how a
// pending gem collects the confirmations that verify it.
//
// Natural v2 additions, deliberately not built yet: leaderboards, badges,
// discovery streaks, and moderator review of REJECTED gems.

import { haversineKm } from '@/lib/routing'

export const REVEAL_RADIUS_M = 750
/** Confirming needs a GPS fix at least this good. */
export const MAX_GPS_ACCURACY_M = 150
export const VERIFY_THRESHOLD = 3
/** Between a photo spot (30) and a vendor (50), same as other Discoveries. */
export const GEM_DISCOVERY_POINTS = 40
/** One-time bonus to the submitter when their gem is verified. */
export const GEM_SUBMITTER_BONUS = 150
export const MAX_SUBMISSIONS_PER_DAY = 5

export const GEM_CATEGORIES = ['WATERFALL', 'HOT_SPRING', 'CULTURAL_ARTIFACT', 'VIEWPOINT', 'OTHER'] as const
export type GemCategoryKey = (typeof GEM_CATEGORIES)[number]

export const GEM_CATEGORY_LABELS: Record<GemCategoryKey, string> = {
  WATERFALL: 'Waterfall / river',
  HOT_SPRING: 'Hot spring',
  CULTURAL_ARTIFACT: 'Cultural find',
  VIEWPOINT: 'Viewpoint',
  OTHER: 'Something else'
}

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineKm(a, b) * 1000
}

// ~2.2 km cells: enough to say "around here" without giving the spot away.
const FOG_CELL_DEG = 0.02

export function fogCell(lat: number, lng: number) {
  return {
    lat: Math.floor(lat / FOG_CELL_DEG) * FOG_CELL_DEG + FOG_CELL_DEG / 2,
    lng: Math.floor(lng / FOG_CELL_DEG) * FOG_CELL_DEG + FOG_CELL_DEG / 2
  }
}

export function parseCoord(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}
