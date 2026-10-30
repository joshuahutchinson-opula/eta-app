// lib/checkins.ts — check-in rules shared by the API and the check-in button.

/** How close you must be to a vendor or photo spot to check in. */
export const CHECKIN_RADIUS_M = 150
/** Earned once per place per day. */
export const CHECKIN_POINTS = 10
/** One-time bonus for a place you've never been to (same as other Discoveries). */
export const DISCOVERY_POINTS = { vendor: 50, photospot: 30 } as const
