// components/ShareLocationToggle.tsx — opt-in live location for the crew on
// a booked trip. While on, the device's position is sent every ~30 s (or
// when it moves); turning it off tells the server to forget it. It only runs
// while the trip screen is open — browsers don't share location in the
// background.
'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { tripApi } from '@/lib/trip-client'
import { haversineKm } from '@/lib/routing'

const KEY = (slug: string) => `eta_trip_share_loc_${slug}`

export default function ShareLocationToggle({ slug, onChange }: { slug: string; onChange?: () => void }) {
  const { t } = useLang()
  const [on, setOn] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const last = useRef<{ lat: number; lng: number; at: number } | null>(null)

  useEffect(() => {
    try { setOn(sessionStorage.getItem(KEY(slug)) === '1') } catch {}
  }, [slug])

  useEffect(() => {
    if (!on || !navigator.geolocation) return
    const watch = navigator.geolocation.watchPosition(
      p => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude }
        const prev = last.current
        if (prev && Date.now() - prev.at < 30000 && haversineKm(prev, pos) < 0.025) return
        last.current = { ...pos, at: Date.now() }
        tripApi(slug, '/location', { method: 'POST', body: pos }).then(() => onChange?.()).catch(() => {})
      },
      () => { setBlocked(true); setOn(false) },
      { enableHighAccuracy: true, maximumAge: 15000 }
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [on, slug, onChange])

  const toggle = () => {
    const next = !on
    setOn(next)
    setBlocked(false)
    try { sessionStorage.setItem(KEY(slug), next ? '1' : '0') } catch {}
    if (!next) {
      last.current = null
      tripApi(slug, '/location', { method: 'POST', body: { stop: true } }).then(() => onChange?.()).catch(() => {})
    }
  }

  return (
    <div className="card" style={{ padding: 14, cursor: 'default', marginBottom: 16 }}>
      <button role="switch" aria-checked={on} onClick={toggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', minHeight: 44 }}>
        <Icon name="navigate" size={18} style={{ color: on ? 'var(--live)' : 'var(--label-secondary)' }} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--label-primary)' }}>{on ? t('m.crew.sharing') : t('m.crew.shareLocation')}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--label-secondary)', marginTop: 2 }}>{t('m.crew.shareLocationBody')}</span>
        </span>
        <span aria-hidden style={{ width: 48, height: 28, borderRadius: 999, background: on ? 'var(--rum)' : 'var(--separator)', position: 'relative', flexShrink: 0, transition: 'background 0.2s ease' }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: on ? 23 : 3, transition: 'left 0.2s ease' }} />
        </span>
      </button>
      {blocked && <p role="alert" style={{ fontSize: 12, color: 'var(--error)', marginTop: 6 }}>{t('m.crew.locationBlocked')}</p>}
    </div>
  )
}
