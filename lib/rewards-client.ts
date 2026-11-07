// lib/rewards-client.ts — keeps the cached user's points, lifetime points
// and tier in step after anything that earns or spends (a scan, a payment,
// a redemption…). setCurrentUser fires USER_EVENT, so the points pill and
// the tier-up moment (components/rewards/TierUpCelebration) react.
'use client'

import { apiJson } from '@/lib/api-client'
import { getAuthToken, getCurrentUser, setCurrentUser, type CurrentUser } from '@/lib/auth-client'

/** Re-reads the signed-in user from the server. */
export async function refreshMe(): Promise<CurrentUser | null> {
  if (!getAuthToken()) return null
  try {
    const d = await apiJson<{ user: CurrentUser }>('/api/users/me')
    if (d.user) setCurrentUser(d.user)
    return d.user ?? null
  } catch {
    return null
  }
}

/** Applies balances a response already returned, without a round trip. */
export function applyBalances(b: { points?: number | null; totalPoints?: number | null; lifetimePoints?: number | null }) {
  const u = getCurrentUser()
  if (!u) return
  const points = b.points ?? b.totalPoints
  setCurrentUser({ ...u, ...(typeof points === 'number' ? { points } : {}), ...(typeof b.lifetimePoints === 'number' ? { lifetimePoints: b.lifetimePoints } : {}) })
}
