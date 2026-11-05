// components/PartiesHappenings.tsx — Experiences' Parties & Happenings:
// big event cards (when, venue, price or Free, promoter, a one-line pitch,
// how many are interested) for the region, filtered Tonight / This weekend /
// This week. Tapping a card opens the event.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { useEventFormat, type EventItem } from '@/lib/events'
import { triggerHaptic } from '@/lib/haptics'
import type { DictKey } from '@/lib/i18n'

const FILTERS: Array<{ id: 'tonight' | 'weekend' | 'week'; label: DictKey }> = [
  { id: 'tonight', label: 'm.events.window.tonight' },
  { id: 'weekend', label: 'm.events.window.weekend' },
  { id: 'week', label: 'm.ph.thisWeek' }
]

function oneLine(text: string): string {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text
  return first.length > 110 ? `${first.slice(0, 107).trimEnd()}…` : first
}

export default function PartiesHappenings() {
  const { t } = useLang()
  const { when } = useEventFormat()
  const { city, town, ready } = useRegion()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('tonight')
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    setEvents(null)
    setFailed(false)
    fetch(`/api/events?city=${city}&window=${filter}&limit=12`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('events'))))
      .then(d => { if (!cancelled) setEvents(Array.isArray(d) ? d : []) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [city, ready, filter, attempt])

  return (
    <section style={{ marginTop: '24px' }} aria-label={t('m.events.eyebrow')}>
      <div className="section-header" style={{ padding: '0 16px' }}>
        <div className="section-heading">
          <span className="section-eyebrow">{town.name}</span>
          <span className="section-title">{t('m.events.eyebrow')}</span>
        </div>
        <Link href={`/events?when=${filter}`} className="section-link">{t('m.common.seeAll')}</Link>
      </div>
      <div role="tablist" aria-label={t('m.events.eyebrow')} style={{ display: 'flex', gap: '8px', padding: '0 16px 12px' }}>
        {FILTERS.map(f => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip ${filter === f.id ? 'active' : ''}`} onClick={() => { triggerHaptic('selection'); setFilter(f.id) }}>
            {t(f.label)}
          </button>
        ))}
      </div>

      {failed ? (
        <div style={{ padding: '0 16px' }}><ErrorState compact onRetry={() => setAttempt(a => a + 1)} /></div>
      ) : events === null ? (
        <div className="horizontal-scroll" style={{ padding: '0 16px 4px' }}>
          {[0, 1].map(i => <div key={i} className="skeleton-card" style={{ flexShrink: 0, width: '85%', height: '320px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)}
        </div>
      ) : events.length === 0 ? (
        <p style={{ padding: '0 16px', fontSize: '14px', color: 'var(--label-secondary)' }}>{t('m.ph.empty', { town: town.name })}</p>
      ) : (
        <div className="horizontal-scroll" style={{ padding: '0 16px 4px', scrollSnapType: 'x mandatory' }}>
          {events.map(ev => {
            const image = ev.imageUrl || ev.vendor?.images?.[0] || null
            return (
              <Link key={ev.id} href={`/events/${ev.id}`} onClick={() => triggerHaptic('light')} style={{ flexShrink: 0, width: events.length > 1 ? '85%' : '100%', textDecoration: 'none', scrollSnapAlign: 'start' }}>
                <div className="card" style={{ height: '100%' }}>
                  <div className="card-image" style={{ height: '170px', background: 'var(--system-bg-secondary)' }}>
                    {image ? <Img src={image} alt={ev.title} width={720} height={340} sizes="85vw" /> : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}><Icon name="party" size={36} /></div>
                    )}
                    <div className="card-overlay" />
                    <div className="card-badge num-font"><Icon name="clock" size={11} /> {when(ev.startAt)}</div>
                    <span style={{ position: 'absolute', top: '10px', right: '10px', padding: '4px 10px', borderRadius: '999px', background: ev.isFree ? 'var(--success)' : 'rgba(0,0,0,0.65)', color: 'white', fontSize: '13px', fontWeight: 700 }}>
                      {ev.isFree ? t('m.events.free') : ev.price !== null ? <Price usd={ev.price} style={{ color: 'white' }} /> : t('m.events.priceNotListed')}
                    </span>
                  </div>
                  <div className="card-content" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--label-primary)', lineHeight: 1.2 }}>{ev.title}</p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <Icon name="mapPin" size={12} /> {ev.venueName}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--label-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="user" size={12} /> {t('m.ph.by', { promoter: ev.promoterName })}
                    </p>
                    {ev.description && <p style={{ fontSize: '14px', color: 'var(--label-primary)', lineHeight: 1.35, marginTop: '2px' }}>{oneLine(ev.description)}</p>}
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--rum-text)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Icon name="users" size={12} />
                      {ev.interestedCount ? (ev.interestedCount === 1 ? t('m.events.oneInterested') : t('m.events.interestedCount', { n: ev.interestedCount })) : t('m.ph.beFirst')}
                    </p>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}
