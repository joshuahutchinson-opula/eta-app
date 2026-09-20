// lib/rewardTiers.ts
// Single source of truth for the four-tier loyalty ladder. Tier is derived
// from a user's real `points` total rather than the stored `level` enum, so
// it always reflects current standing and stays in sync everywhere it's shown.

export interface RewardTier {
  key: string
  label: string
  threshold: number
  icon: string
  perks: string[]
}

export const REWARD_TIERS: RewardTier[] = [
  {
    key: 'WANDERER',
    label: 'Newcomer',
    threshold: 0,
    icon: 'compass',
    perks: ['Full access to the rewards catalog', 'Earn points on every booking and payment']
  },
  {
    key: 'EXPLORER',
    label: 'Regular',
    threshold: 500,
    icon: 'sparkle',
    perks: ['5% bonus points on every booking', 'Early notice on new flash deals']
  },
  {
    key: 'TRAILBLAZER',
    label: 'Trailblazer',
    threshold: 1500,
    icon: 'crown',
    perks: ['Priority table holds at top-rated spots', '10% bonus points on every booking']
  },
  {
    key: 'LOCAL_LEGEND',
    label: 'Legend',
    threshold: 3500,
    icon: 'star',
    perks: ['Access to Legend-exclusive rewards', 'Free priority booking on every experience', '15% bonus points on every booking']
  }
]

export function getTierForPoints(points: number): RewardTier {
  let current = REWARD_TIERS[0]
  for (const tier of REWARD_TIERS) {
    if (points >= tier.threshold) current = tier
  }
  return current
}

export function getNextTier(points: number): RewardTier | null {
  const current = getTierForPoints(points)
  const idx = REWARD_TIERS.findIndex(t => t.key === current.key)
  return idx >= 0 && idx < REWARD_TIERS.length - 1 ? REWARD_TIERS[idx + 1] : null
}

/** Progress toward the user's next tier (0-100), and points still needed. Maxed-out (Legend) users get 100%/0. */
export function tierProgress(points: number): { percent: number; pointsToNext: number; next: RewardTier | null } {
  const current = getTierForPoints(points)
  const next = getNextTier(points)
  if (!next) return { percent: 100, pointsToNext: 0, next: null }
  const span = next.threshold - current.threshold
  const into = points - current.threshold
  const percent = Math.max(0, Math.min(100, Math.round((into / span) * 100)))
  return { percent, pointsToNext: Math.max(0, next.threshold - points), next }
}
