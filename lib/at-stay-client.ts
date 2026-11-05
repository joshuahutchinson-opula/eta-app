// lib/at-stay-client.ts — "At your stay" on the device: loads the partner
// property the guest came in with (their partner code, from a code, QR or
// picking it as their stay) and shares it with every screen that leans on it.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTripMode } from '@/lib/trip-mode'
import type { AtStay } from '@/lib/at-stay'
import type { HostContext } from '@/lib/host-lean'

const CACHE_MS = 10 * 60 * 1000
const cache = new Map<string, { at: number; data: AtStay | null }>()

export function useAtStay(): { stay: AtStay | null; host: HostContext | null } {
  const { trip } = useTripMode()
  const code = trip.partnerCode
  const [stay, setStay] = useState<AtStay | null>(code ? cache.get(code)?.data ?? null : null)

  useEffect(() => {
    if (!code) { setStay(null); return }
    const hit = cache.get(code)
    if (hit && Date.now() - hit.at < CACHE_MS) { setStay(hit.data); return }
    let cancelled = false
    fetch(`/api/partners/${encodeURIComponent(code)}/stay`)
      .then(r => (r.ok ? r.json() : null))
      .then((d: AtStay | null) => { cache.set(code, { at: Date.now(), data: d }); if (!cancelled) setStay(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [code])

  const host = useMemo<HostContext | null>(() => (stay ? { covers: stay.covers, vendorIds: stay.vendors.map(v => v.id) } : null), [stay])
  return { stay, host }
}
