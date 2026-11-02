// lib/cancellation.ts — ETA's cancellation tiers and the refund they give.
// Each experience and stay has a tier (cancellationTier). The BookingSheet
// shows the summary before paying; /api/bookings/[id]/cancel applies it.
// The full wording lives on /policies/cancellation (DRAFT pending legal review).
//
// Refunds go back to the ETA Wallet balance (placeholder payments). The
// ETA service fee is refunded whenever the booking amount is.

export type CancellationTier = 'flexible' | 'standard' | 'strict'

interface Rule {
  /** At least this many hours before the start… */
  minHours: number
  /** …refund this share of the total. */
  refund: number
}

export const TIERS: Record<CancellationTier, Rule[]> = {
  // Full refund up to 24 h before.
  flexible: [{ minHours: 24, refund: 1 }],
  // Full refund up to 48 h before, half up to 24 h before.
  standard: [{ minHours: 48, refund: 1 }, { minHours: 24, refund: 0.5 }],
  // Half refund up to 7 days before.
  strict: [{ minHours: 7 * 24, refund: 0.5 }]
}

export function parseTier(value: string | null | undefined): CancellationTier {
  return value === 'flexible' || value === 'strict' ? value : 'standard'
}

export function refundShare(tier: CancellationTier, start: Date, now = new Date()): number {
  const hours = (start.getTime() - now.getTime()) / 3600000
  for (const rule of TIERS[tier]) if (hours >= rule.minHours) return rule.refund
  return 0
}

export function refundAmount(tier: CancellationTier, total: number, start: Date, now = new Date()): number {
  return Math.round(total * refundShare(tier, start, now) * 100) / 100
}

/** Rescheduling is free while a full refund would still apply; after that it isn't allowed. */
export function canReschedule(tier: CancellationTier, start: Date, now = new Date()): boolean {
  return refundShare(tier, start, now) === 1
}

/** The i18n keys of each tier's one-line summary (lib/i18n.ts). */
export const TIER_SUMMARY_KEY = {
  flexible: 'm.cancel.flexible',
  standard: 'm.cancel.standard',
  strict: 'm.cancel.strict'
} as const
