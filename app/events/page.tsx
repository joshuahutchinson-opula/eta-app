// app/events/page.tsx — every event in the selected region, filtered by
// when: tonight, tomorrow, this weekend or all week (Jamaica time).
'use client'

import { useCallback, useEffect, useState } from 'react'
import Dock from '@/components/Dock'
import BackButton from '@/components/BackButton'
import EventCard from '@/components/EventCard'
import ErrorState from '@/components/ErrorState'
import { RegionPill } from '@/components/RegionSelector'
import { useRegion } from '@/components/RegionProvider'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import type { EventItem } from '@/lib/events'

const WINDOWS = ['tonight', 'tomorrow', 'weekend', 'week'] as const
type Window = (typeof WINDOWS)[number]

export default function AllEventsPage() {
  const { t } = useLang()
  const { city, town, ready } = useRegion()
  const [win, setWin] = useState<Window>('week')
  const [events, setEvents] = useState<EventItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const w = new URLSearchParams(window.location.search).get('when')
    if (WINDOWS.includes(w as Window)) setWin(w as Window)
  }, [])

  const load = useCallback(async () => {
    setFailed(false)
    setEvents(null)
    try {
      const res = await fetch(`/api/events?city=${city}&window=${win}&limit=60`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setFailed(true)
    }
  }, [city, win])

  useEffect(() => { if (ready) load() }, [ready, load])

  const label = (w: Window) => t(`m.events.window.${w}` as 'm.events.window.week')

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: '80px' }}>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton />
        <div className="section-heading" style={{ flex: 1, minWidth: 0 }}>
          <span className="section-eyebrow">{t('m.events.eyebrow')}</span>
          <h1 className="section-title">{t('m.events.allTitle')}</h1>
        </div>
        <RegionPill />
      </div>
      <div className="horizontal-scroll" role="tablist" style={{ padding: '0 16px 12px', gap: '8px' }}>
        {WINDOWS.map(w => (
          <button key={w} role="tab" aria-selected={win === w} className={`chip ${win === w ? 'active' : ''}`} onClick={() => { triggerHaptic('selection'); setWin(w) }} style={{ flexShrink: 0 }}>
            {label(w)}
          </button>
        ))}
      </div>
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {failed ? <ErrorState onRetry={load} /> : events === null ? (
          [0, 1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '220px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : events.length === 0 ? (
          <div className="empty-state">
            <Icon name="party" size={32} style={{ color: 'var(--label-tertiary)' }} />
            <p style={{ fontSize: '17px', fontWeight: 600, color: 'var(--label-primary)' }}>{t('m.events.windowEmpty', { when: label(win).toLowerCase(), town: town.name })}</p>
          </div>
        ) : events.map(ev => <EventCard key={ev.id} ev={ev} width="100%" />)}
      </div>
      <Dock />
    </main>
  )
}
