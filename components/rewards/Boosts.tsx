// components/rewards/Boosts.tsx — Today's boosts on the Rewards hub: vendor
// quiet hours (with a live countdown while they run, or when they start),
// the rainy-day boost when rain is forecast, and the crew bonus. They stack
// on the base points (lib/boosts.ts).
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export interface BoostView {
  id: string
  kind: 'quiet_hour' | 'rainy_day' | 'crew'
  title: string
  multiplier: number
  bonus: number
  startMin: number | null
  endMin: number | null
  live: boolean
  endsAt: string | null
  vendor: { id: string; name: string; imageUrl: string | null } | null
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function Boosts({ boosts }: { boosts: BoostView[] }) {
  const { t, lang } = useLang()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!boosts.some(b => b.live && b.endsAt)) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [boosts])

  const countdown = (iso: string) => {
    const s = Math.max(0, Math.floor((Date.parse(iso) - now) / 1000))
    const h = Math.floor(s / 3600)
    return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${Math.floor(s / 60)}:${pad(s % 60)}`
  }
  const clock = (min: number) => {
    const d = new Date(Date.UTC(2000, 0, 1, Math.floor(min / 60) + 5, min % 60))
    return d.toLocaleTimeString(lang === 'en' ? 'en-US' : lang, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })
  }
  const x = (m: number) => Number.isInteger(m) ? String(m) : m.toFixed(1)

  if (!boosts.length) return <p className="rw-pad" style={{ fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.rw.boostNone')}</p>
  return (
    <div className="rw-boosts">
      {boosts.map(b => {
        const ended = b.live && b.endsAt && Date.parse(b.endsAt) <= now
        const body = (
          <>
            <span className={`rw-boost-x ${b.kind === 'rainy_day' ? 'rain' : b.kind === 'crew' ? 'crew' : ''}`} aria-hidden>
              {b.kind === 'crew' ? <Icon name="users" size={22} /> : b.kind === 'rainy_day' ? <Icon name="umbrella" size={22} /> : `${x(b.multiplier)}×`}
            </span>
            <span style={{ minWidth: 0, display: 'block' }}>
              <p className="rw-boost-title">
                {b.kind === 'crew' ? t('m.rw.boostCrew', { n: b.bonus }) : b.kind === 'rainy_day' ? t('m.rw.boostRain', { x: x(b.multiplier) }) : t('m.rw.boostX', { x: x(b.multiplier) })}
              </p>
              <p className="rw-boost-sub">{b.kind === 'crew' ? t('m.rw.boostCrewSub') : b.kind === 'rainy_day' ? t('m.rw.boostRainSub') : b.vendor?.name ?? b.title}</p>
              {b.kind === 'quiet_hour' && !ended && (
                <p className="rw-boost-time num-font">
                  {b.live && b.endsAt ? <><span className="rw-live-dot" aria-hidden /> {t('m.rw.endsIn', { time: countdown(b.endsAt) })}</> : b.startMin !== null ? <><Icon name="clock" size={12} /> {t('m.rw.startsAt', { time: clock(b.startMin) })}</> : null}
                </p>
              )}
            </span>
          </>
        )
        return b.vendor
          ? <Link key={b.id} href={`/vendor/${b.vendor.id}`} onClick={() => triggerHaptic('light')} className={`rw-boost press ${b.live ? 'live' : ''}`}>{body}</Link>
          : <div key={b.id} className={`rw-boost ${b.live ? 'live' : ''}`}>{body}</div>
      })}
    </div>
  )
}
