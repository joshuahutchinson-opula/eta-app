// lib/hidden-gems.ts — rules for Hidden Gems: Explore mode's secret spots
// (hidden gems, viewpoints, street art, swimming spots, local favourites).
// They live only in Explore mode (app/explore, lib/explore.ts), never on
// Discover, in search or anywhere else.
//
// Secrecy is enforced here, on the server: a gem's name, photos and exact
// location are only sent to someone whose live position is within
// REVEAL_RADIUS_M of it (or to its submitter). Before that, Explore mode
// gets a rough zone and a warmer/colder band, so reading the API response
// can't give the spot away.
//
// Anyone who walks within range can find and confirm a pending gem; that's
// how it collects the confirmations that verify it.

import { haversineKm } from '@/lib/routing'

export const REVEAL_RADIUS_M = 100
/** Confirming needs a GPS fix at least this good. */
export const MAX_GPS_ACCURACY_M = 150
export const VERIFY_THRESHOLD = 3
/** Between a photo spot (30) and a vendor (50), same as other Discoveries. */
export const GEM_DISCOVERY_POINTS = 40
/** One-time bonus to the submitter when their gem is verified. */
export const GEM_SUBMITTER_BONUS = 150
export const MAX_SUBMISSIONS_PER_DAY = 5

export const GEM_CATEGORIES = ['WATERFALL', 'HOT_SPRING', 'CULTURAL_ARTIFACT', 'VIEWPOINT', 'STREET_ART', 'SWIMMING_SPOT', 'LOCAL_FAVOURITE', 'OTHER'] as const
export type GemCategoryKey = (typeof GEM_CATEGORIES)[number]

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  return haversineKm(a, b) * 1000
}

export function parseCoord(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}
