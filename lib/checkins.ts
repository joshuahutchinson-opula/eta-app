// lib/checkins.ts — check-in rules shared by the API and the check-in screens.

/** How close you must be to a photo spot to check in by GPS. */
export const CHECKIN_RADIUS_M = 150
/** Scanning a vendor's QR card only counts within this distance of the vendor. */
export const QR_VISIT_RADIUS_M = 100
/** Earned once per place per day. */
export const CHECKIN_POINTS = 10
/** One-time bonus for a place you've never been to (same as other Discoveries). */
export const DISCOVERY_POINTS = { vendor: 50, photospot: 30 } as const
