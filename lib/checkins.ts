// lib/checkins.ts — check-in rules shared by the API and the check-in screens.
// (Points for check-ins live in lib/earn-config.ts.)

/** How close you must be to a photo spot to check in by GPS. */
export const CHECKIN_RADIUS_M = 150
/** Scanning a vendor's QR card only counts within this distance of the vendor. */
export const QR_VISIT_RADIUS_M = 100
