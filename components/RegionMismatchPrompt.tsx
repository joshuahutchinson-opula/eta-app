// components/RegionMismatchPrompt.tsx — when the phone is clearly in a
// different supported town from the one selected ("You're in Ocho Rios —
// switch?"). Shown once per town: switching or dismissing remembers it.
'use client'

import { useEffect, useState } from 'react'
import Icon from '@/lib/icons'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { nearestTown, type Town } from '@/lib/regions'
import { haversineKm } from '@/lib/routing'
import { triggerHaptic } from '@/lib/haptics'

const KEY = 'eta_region_prompted'
/** Within this distance of a town centre counts as "clearly in" it. */
const CLEARLY_IN_KM = 12

function prompted(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export default function RegionMismatchPrompt() {
  const { t } = useLang()
  const { city, town, ready, setCity } = useRegion()
  const [here, setHere] = useState<Town | null>(null)

  useEffect(() => {
    if (!ready || !navigator.geolocation) return
    // Only ask the browser if location was already allowed — this is a
    // nudge, not a reason to pop a permission prompt.
    const check = () => navigator.geolocation.getCurrentPosition(p => {
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
      const nearest = nearestTown(pos)
      if (haversineKm(pos, nearest) <= CLEARLY_IN_KM) setHere(nearest)
    }, () => {}, { maximumAge: 10 * 60 * 1000, timeout: 10000 })
    const perms = (navigator as Navigator & { permissions?: Permissions }).permissions
    if (perms?.query) perms.query({ name: 'geolocation' as PermissionName }).then(s => { if (s.state === 'granted') check() }).catch(() => {})
  }, [ready])

  if (!here || here.city === city || prompted().includes(here.city)) return null

  const remember = () => { try { localStorage.setItem(KEY, JSON.stringify([...prompted(), here.city])) } catch {} }

  return (
    <div style={{ padding: '12px 16px 0' }}>
      <div className="card" role="status" style={{ padding: '12px 14px', cursor: 'default', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <Icon name="mapPin" size={18} style={{ color: 'var(--rum-text)' }} />
        <p style={{ flex: 1, minWidth: '160px', fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.region.mismatch', { town: here.name })}</p>
        <button className="btn btn-primary" style={{ minHeight: '36px', padding: '0 14px', fontSize: '14px' }} onClick={() => { triggerHaptic('selection'); remember(); setCity(here.city); setHere(null) }}>{t('m.region.switch')}</button>
        <button className="btn btn-tertiary" style={{ minHeight: '36px', padding: '0 8px', fontSize: '14px' }} onClick={() => { remember(); setHere(null) }}>{t('m.region.stay', { town: town.name })}</button>
      </div>
    </div>
  )
}
