// components/EventsSection.tsx — "This Week's Events" on Home and Market.
// Promoter events (not vendors) for the selected region, with a way into
// the full list (/events).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import ErrorState from '@/components/ErrorState'
import EventCard from '@/components/EventCard'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import type { EventItem } from '@/lib/events'

export default function EventsSection({ padded = true }: { padded?: boolean }) {
  const { city, town, ready } = useRegion()
  const { t } = useLang()
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch(`/api/events?city=${city}&days=7&limit=10`)
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
        <Link href="/events" className="section-link">{t('m.events.seeAll')}</Link>
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
          {events.map(ev => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}
    </div>
  )
}
