// lib/visit-client.ts — sending a scanned vendor QR code to /api/visits with
// a fresh, precise location (the server checks the distance). Used by the
// in-app scanner and by /v/<token>, where the phone camera lands.
'use client'

import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import { hapticRewardRedeemed } from '@/lib/haptics'

export interface VisitResult {
  visitId: string
  pointsAwarded: number
  firstDiscovery: boolean
  totalPoints: number
  vendor: { id: string; name: string }
  unlockedRewards: Array<{ id: string; name: string; cost: number; icon: string }>
}

export class LocationError extends Error {}

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new LocationError('no-geolocation'))
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new LocationError('denied')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  })
}

export async function submitVisit(code: string): Promise<VisitResult> {
  const p = await position()
  const result = await apiJson<VisitResult>('/api/visits', { method: 'POST', body: { code, lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy } })
  const u = getCurrentUser()
  if (u) setCurrentUser({ ...u, points: result.totalPoints })
  hapticRewardRedeemed()
  return result
}
