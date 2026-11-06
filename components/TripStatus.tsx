// components/TripStatus.tsx — trip mode on Home.
//   TripDayChip — "Day 3 of 7" next to the greeting while the trip is on.
//   TripEndCards — once it's over: the shareable recap, and (when the phone
//                  is back outside Jamaica) "planning your next trip?" with
//                  the points that never expire.
'use client'

import Link from 'next/link'
import Icon from '@/lib/icons'
import { useTripMode } from '@/lib/trip-mode'
import { useLang } from '@/lib/i18n-client'
import { getCurrentUser } from '@/lib/auth-client'
import type { LatLng } from '@/lib/routing'

/** Rough box around the island; anything outside is "home". */
export function inJamaica(p: LatLng): boolean {
  return p.lat > 17.6 && p.lat < 18.6 && p.lng > -78.5 && p.lng < -76.1
}

export function TripDayChip({ glass = false }: { glass?: boolean }) {
  const { t } = useLang()
  const { progress } = useTripMode()
  if (!progress || progress.phase === 'after') return null
  return (
    <Link href="/experiences" className={glass ? 'glass-pill press' : 'chip'} style={glass ? { minHeight: '32px', padding: '0 12px', fontSize: '13px', fontWeight: 700, flexShrink: 0 } : { minHeight: '32px', padding: '4px 10px', fontSize: '13px', fontWeight: 700, textDecoration: 'none', background: 'var(--rum-tint)', color: 'var(--rum-text)', flexShrink: 0 }}>
      <Icon name="calendar" size={12} />
      <span className="num-font">
        {progress.phase === 'during' ? t('m.trip.dayOf', { day: progress.day, total: progress.total }) : t('m.trip.startsIn', { n: progress.daysUntil })}
      </span>
    </Link>
  )
}

export function TripEndCards({ location }: { location: LatLng | null }) {
  const { t, lang } = useLang()
  const { progress } = useTripMode()
  if (!progress || progress.phase !== 'after') return null
  const user = getCurrentUser()
  const home = location ? !inJamaica(location) : false
  const points = user?.points ?? 0
  return (
    <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <Link href="/recap" className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', textDecoration: 'none', background: 'linear-gradient(135deg, var(--rum), #6e1a0c)' }}>
        <Icon name="route" size={22} style={{ color: 'white' }} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'white' }}>{t('m.recap.ready')}</span>
          <span style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{t('m.recap.readySub')}</span>
        </span>
        <Icon name="chevronRight" size={14} style={{ color: 'rgba(255,255,255,0.8)' }} />
      </Link>
      {home && (
        <Link href="/onboarding?step=dates" className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', textDecoration: 'none' }}>
          <Icon name="plane" size={22} style={{ color: 'var(--rum-text)' }} />
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.nextTrip.title')}</span>
            <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>
              {points > 0 ? t('m.nextTrip.points', { n: points.toLocaleString(lang === 'en' ? 'en-US' : lang) }) : t('m.nextTrip.noPoints')}
            </span>
          </span>
          <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
        </Link>
      )}
    </div>
  )
}
