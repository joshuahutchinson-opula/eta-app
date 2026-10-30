// components/EventsSection.tsx — "This Week's Events" on Home and Market.
// Promoter events (not vendors) for the selected region.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { eventWhen, type EventItem } from '@/lib/events'

export default function EventsSection({ padded = true }: { padded?: boolean }) {
  const { city, town, ready } = useRegion()
  const { t } = useLang()
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch(`/api/events?city=${city}&days=7`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => { if (ready) load() }, [ready, load])

  const pad = padded ? '16px' : '0'

  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="section-header" style={{ paddingLeft: pad, paddingRight: pad }}>
        <div className="section-heading">
          <span className="section-eyebrow">{t('m.events.eyebrow')}</span>
          <span className="section-title">{t('m.events.title')}</span>
        </div>
      </div>
      {failed ? (
        <ErrorState compact onRetry={load} />
      ) : events === null ? (
        <div className="horizontal-scroll" style={{ padding: `4px ${pad} 12px` }}>
          {[0, 1].map(i => (
            <div key={i} className="skeleton-card" style={{ width: '240px', height: '200px', flexShrink: 0 }}>
              <div className="skeleton-image" style={{ height: '100%' }} />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p style={{ padding: `4px ${pad} 0`, fontSize: '14px', color: 'var(--label-secondary)' }}>
          {t('m.events.empty', { town: town.name })}
        </p>
      ) : (
        <div className="horizontal-scroll" style={{ padding: `4px ${pad} 12px` }}>
          {events.map(ev => (
            <Link key={ev.id} href={`/events/${ev.id}`} onClick={() => triggerHaptic('light')} style={{ textDecoration: 'none', flexShrink: 0 }}>
              <div className="card" style={{ width: '240px' }}>
                <div className="card-image" style={{ height: '130px', background: 'var(--system-bg-secondary)' }}>
                  {ev.imageUrl ? <img src={ev.imageUrl} alt={ev.title} /> : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}>
                      <Icon name="party" size={32} />
                    </div>
                  )}
                  <div className="card-overlay" />
                  <div className="card-badge">
                    <Icon name="clock" size={11} />
                    {eventWhen(ev.startAt)}
                  </div>
                </div>
                <div className="card-content">
                  <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--label-primary)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</p>
                  <p style={{ fontSize: '13px', color: 'var(--label-secondary)', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Icon name="mapPin" size={11} /> {ev.venueName}
                  </p>
                  {ev.isFree ? (
                    <span className="card-price">{t('m.events.free')}</span>
                  ) : ev.price !== null ? (
                    <Price usd={ev.price} className="card-price" />
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--label-tertiary)' }}>{t('m.events.priceNotListed')}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
