// components/home/YourDay.tsx — Home's "Your day": one card. With a booking,
// ticket or trip stop today, the next one (time, place, Directions) and a
// small "then: …" line for the one after (from /api/home/day). With nothing
// planned, a nudge into the Experiences planner.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { directionsUrl } from '@/lib/calendar'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

interface DayItem { kind: 'booking' | 'ticket' | 'stop'; id: string; title: string; place: string | null; at: string | null; lat: number | null; lng: number | null; href: string }

const KIND_ICON = { booking: 'calendar', ticket: 'ticket', stop: 'route' } as const

export default function YourDay({ refreshKey }: { refreshKey: number }) {
  const { t, lang } = useLang()
  const [day, setDay] = useState<{ next: DayItem | null; then: DayItem | null } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!getCurrentUser()) { setDay({ next: null, then: null }); return }
    apiJson<{ next: DayItem | null; then: DayItem | null }>('/api/home/day')
      .then(d => { if (!cancelled) setDay(d) })
      .catch(() => { if (!cancelled) setDay({ next: null, then: null }) })
    return () => { cancelled = true }
  }, [refreshKey])

  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'en' ? 'en-US' : lang, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })

  if (!day) return <div className="home-skel" style={{ height: '132px', margin: '0 20px' }} aria-hidden />

  const { next, then } = day
  if (!next) {
    return (
      <div className="home-card" style={{ margin: '0 20px', padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span style={{ width: '48px', height: '48px', borderRadius: '16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--rum-tint)', color: 'var(--rum-text)' }}>
          <Icon name="sun" size={22} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: '17px', fontWeight: 800, color: 'var(--label-primary)', letterSpacing: '-0.01em' }}>{t('m.home.nothingPlanned')}</span>
          <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', marginTop: '2px' }}>{t('m.home.nothingPlannedSub')}</span>
        </span>
        <Link href="/experiences" onClick={() => triggerHaptic('light')} className="btn btn-primary press" style={{ textDecoration: 'none', minHeight: '40px', padding: '0 14px', fontSize: '14px', flexShrink: 0 }}>
          {t('m.home.planMyDay')}
        </Link>
      </div>
    )
  }

  const nav = directionsUrl({ lat: next.lat, lng: next.lng, name: next.place ?? next.title })
  return (
    <div className="home-card" style={{ margin: '0 20px', padding: '18px' }}>
      <Link href={next.href} onClick={() => triggerHaptic('light')} className="press" style={{ display: 'flex', alignItems: 'center', gap: '14px', textDecoration: 'none', color: 'inherit' }}>
        <span style={{ width: '48px', height: '48px', borderRadius: '16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--rum)', color: 'white' }}>
          <Icon name={KIND_ICON[next.kind]} size={22} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="num-font" style={{ display: 'block', fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--rum-text)' }}>
            {next.at ? t('m.home.nextUp', { time: time(next.at) }) : t('m.home.nextUpUntimed')}
          </span>
          <span style={{ display: 'block', fontSize: '18px', fontWeight: 800, color: 'var(--label-primary)', letterSpacing: '-0.015em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.title}</span>
          {next.place && <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}><Icon name="mapPin" size={11} /> {next.place}</span>}
        </span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
        {then ? (
          <span style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--label-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {then.at ? t('m.home.thenAt', { title: then.title, time: time(then.at) }) : t('m.home.then', { title: then.title })}
          </span>
        ) : <span style={{ flex: 1 }} />}
        {nav && (
          <a href={nav} target="_blank" rel="noopener noreferrer" onClick={() => triggerHaptic('light')} className="btn btn-secondary press" style={{ textDecoration: 'none', minHeight: '40px', padding: '0 14px', fontSize: '14px', flexShrink: 0 }}>
            <Icon name="navigate" size={15} /> {t('m.nav.directions')}
          </a>
        )}
      </div>
    </div>
  )
}
