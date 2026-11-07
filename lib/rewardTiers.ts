// lib/rewardTiers.ts — the status ladder. Tier comes from LIFETIME points
// (User.lifetimePoints, which only goes up), never from the spendable
// balance, so status never drops and carries across trips.
//   Visitor 0 · Explorer 500 · Insider 2,000 · Yaadie 6,000
// Perk text lives in i18n as m.rw.perk.<TIER>.<n>; `perks` is how many.

export type TierKey = 'VISITOR' | 'EXPLORER' | 'INSIDER' | 'YAADIE'

export interface RewardTier {
  key: TierKey
  threshold: number
  icon: string
  /** Number of perk lines (m.rw.perk.<key>.0…n-1). */
  perks: number
}

export const REWARD_TIERS: RewardTier[] = [
  { key: 'VISITOR', threshold: 0, icon: 'compass', perks: 2 },
  { key: 'EXPLORER', threshold: 500, icon: 'sparkle', perks: 2 },
  { key: 'INSIDER', threshold: 2000, icon: 'star', perks: 3 },
  { key: 'YAADIE', threshold: 6000, icon: 'crown', perks: 3 }
]

export function tierIndex(key: string | null | undefined): number {
  const i = REWARD_TIERS.findIndex(t => t.key === key)
  return i < 0 ? 0 : i
}

export function getTierForPoints(lifetimePoints: number): RewardTier {
  let current = REWARD_TIERS[0]
  for (const tier of REWARD_TIERS) if (lifetimePoints >= tier.threshold) current = tier
  return current
}

export function getNextTier(lifetimePoints: number): RewardTier | null {
  const i = tierIndex(getTierForPoints(lifetimePoints).key)
  return i < REWARD_TIERS.length - 1 ? REWARD_TIERS[i + 1] : null
}

/** At least this tier? */
export function atLeast(lifetimePoints: number, key: TierKey): boolean {
  return tierIndex(getTierForPoints(lifetimePoints).key) >= tierIndex(key)
}

/** Progress toward the next tier (0–100) and lifetime points still needed. Yaadie gets 100%/0. */
export function tierProgress(lifetimePoints: number): { percent: number; pointsToNext: number; next: RewardTier | null } {
  const current = getTierForPoints(lifetimePoints)
  const next = getNextTier(lifetimePoints)
  if (!next) return { percent: 100, pointsToNext: 0, next: null }
  const percent = Math.max(0, Math.min(100, Math.round(((lifetimePoints - current.threshold) / (next.threshold - current.threshold)) * 100)))
  return { percent, pointsToNext: Math.max(0, next.threshold - lifetimePoints), next }
}
