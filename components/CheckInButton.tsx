// components/CheckInButton.tsx — "Check in" on vendor and photo spot pages.
// Tracks your position; the button unlocks once you're within range and the
// server (not the device) awards the points.
'use client'

import { useState } from 'react'
import Icon from '@/lib/icons'
import { authHeaders } from '@/lib/api-client'
import { getCurrentUser, setCurrentUser } from '@/lib/auth-client'
import { useWatchedLocation } from '@/lib/geo'
import { haversineKm } from '@/lib/routing'
import { CHECKIN_RADIUS_M } from '@/lib/checkins'
import { useLang } from '@/lib/i18n-client'
import { hapticRewardRedeemed } from '@/lib/haptics'

export default function CheckInButton({ target }: { target: { kind: 'vendor' | 'photospot'; id: string; lat: number; lng: number } }) {
  const { t } = useLang()
  const [watching, setWatching] = useState(false)
  const pos = useWatchedLocation(watching)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const distM = pos ? Math.round(haversineKm(pos, target) * 1000) : null
  const inRange = distM !== null && distM <= CHECKIN_RADIUS_M

  const checkIn = async () => {
    if (!getCurrentUser()) { setMessage({ ok: false, text: t('m.checkin.login') }); return }
    if (!pos) { setWatching(true); return }
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch('/api/checkins', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ [target.kind === 'vendor' ? 'vendorId' : 'photoSpotId']: target.id, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
      const u = getCurrentUser()
      if (u && typeof data.totalPoints === 'number') setCurrentUser({ ...u, points: data.totalPoints })
      hapticRewardRedeemed()
      setMessage({ ok: true, text: data.firstDiscovery ? t('m.checkin.firstTime', { points: data.pointsAwarded }) : t('m.checkin.done', { points: data.pointsAwarded }) })
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : 'Sumth nah wuk' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card" style={{ padding: '12px 14px', marginBottom: '20px', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icon name="mapPin" size={18} style={{ color: 'var(--rum-text)', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: '14px', color: 'var(--label-primary)' }}>
          {!watching ? t('m.checkin.prompt')
            : distM === null ? t('m.checkin.locating')
            : inRange ? t('m.checkin.inRange')
            : t('m.checkin.away', { m: distM < 1000 ? `${distM} m` : `${(distM / 1000).toFixed(1)} km`, radius: CHECKIN_RADIUS_M })}
        </span>
        <button
          className="btn btn-primary"
          onClick={() => (watching ? checkIn() : setWatching(true))}
          disabled={busy || (watching && !inRange) || message?.ok === true}
          style={{ minHeight: '36px', padding: '0 14px', fontSize: '14px' }}
        >
          {busy ? '…' : message?.ok ? <Icon name="check" size={14} /> : t('m.checkin.button')}
        </button>
      </div>
      {message && <p role="status" style={{ fontSize: '13px', marginTop: '8px', color: message.ok ? 'var(--success)' : 'var(--error)' }}>{message.text}</p>}
    </div>
  )
}
