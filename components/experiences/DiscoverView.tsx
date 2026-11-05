// components/experiences/DiscoverView.tsx — Discover: a normal, detailed map
// of the region (streets, road names, buildings, landmarks, beaches) that
// follows you with the live heading arrow (components/map/EtaMap). Vendors,
// events and photo spots are pins coloured by category, named once you zoom
// in; one place card at a time sits at the bottom (swipe for the next
// nearest; Go / View), and category filters are behind a button. Secret
// spots never show here: they're Explore mode's (top-right button).
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Dock from '@/components/Dock'
import EtaMap, { type MapMarker, type MapPoint } from '@/components/map/EtaMap'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { triggerHaptic } from '@/lib/haptics'
import { formatDistance } from '@/lib/geo'
import { haversineKm, MAX_WALK_KM } from '@/lib/routing'
import { directionsUrl } from '@/lib/calendar'
import { formatTime, openState, parseHours } from '@/lib/hours'
import { categoryStyle } from '@/lib/vendor-style'
import { useEventFormat, type EventItem } from '@/lib/events'
import type { MapPhotoSpot, MapVendor } from '@/lib/map-types'
import PlanDiscoverSwitch, { type TabMode } from './PlanDiscoverSwitch'

const CATEGORIES = ['FOOD', 'DRINKS', 'ACTIVITY', 'WELLNESS', 'BEACH', 'EVENTS']
const EVENT_COLOR = '#AF52DE'
const SPOT_COLOR = '#FFB800'
// The place card sits over the bottom of the map.
const CARD_INSET = 190

interface Place {
  key: string
  type: 'vendor' | 'photospot' | 'event'
  id: string
  name: string
  image: string | null
  category: string | null
  hours: unknown
  startAt?: string
  lat: number
  lng: number
}

export default function DiscoverView({ vendors, photoSpots, mode, onModeChange }: {
  vendors: MapVendor[]
  photoSpots: MapPhotoSpot[]
  mode: TabMode
  onModeChange: (m: TabMode) => void
}) {
  const { t } = useLang()
  const labels = useLabels()
  const { when } = useEventFormat()
  const { city, town, ready } = useRegion()
  const [pos, setPos] = useState<MapPoint | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [category, setCategory] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ready) return
    fetch(`/api/events?city=${city}&days=7&limit=40`).then(r => (r.ok ? r.json() : [])).then(d => setEvents(Array.isArray(d) ? d : [])).catch(() => setEvents([]))
  }, [city, ready])

  // Re-sorting waits for ~50 m of movement, not every GPS tick.
  const onPosition = useCallback((p: MapPoint) => setPos(prev => (prev && haversineKm(prev, p) < 0.05 ? prev : p)), [])

  const allPlaces: Place[] = useMemo(() => [
    ...vendors.filter(v => !v.city || v.city === city).map(v => ({ key: `vendor:${v.id}`, type: 'vendor' as const, id: v.id, name: v.name, image: v.images?.[0] ?? null, category: v.category, hours: v.hours, lat: v.lat, lng: v.lng })),
    ...photoSpots.filter(s => !s.city || s.city === city).map(s => ({ key: `photospot:${s.id}`, type: 'photospot' as const, id: s.id, name: s.name, image: s.officialPhoto ?? null, category: null, hours: null, lat: s.lat, lng: s.lng })),
    ...events.filter(e => e.lat !== null && e.lng !== null).map(e => ({ key: `event:${e.id}`, type: 'event' as const, id: e.id, name: e.title, image: e.imageUrl ?? e.vendor?.images?.[0] ?? null, category: 'EVENTS', hours: null, startAt: e.startAt, lat: e.lat!, lng: e.lng! }))
  ], [vendors, photoSpots, events, city])

  const shown = useMemo(() => allPlaces.filter(p => !category || p.category === category), [allPlaces, category])

  // Nearest first: from you, or the town centre until we have your position.
  const from = pos ?? { lat: town.lat, lng: town.lng }
  const places = useMemo(() => shown
    .map(p => ({ ...p, km: haversineKm(from, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 30),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [shown, Math.round(from.lat * 1000), Math.round(from.lng * 1000)])

  useEffect(() => { setIndex(0); track.current?.scrollTo({ left: 0 }) }, [category, city])

  const current = places[Math.min(index, Math.max(0, places.length - 1))]
  const show = (key: string) => {
    const i = places.findIndex(p => p.key === key)
    const el = track.current
    if (i === -1 || !el) return
    triggerHaptic('light')
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const markers: MapMarker[] = useMemo(() => shown.map(p => ({
    id: p.key,
    lat: p.lat,
    lng: p.lng,
    color: p.type === 'event' ? EVENT_COLOR : p.type === 'photospot' ? SPOT_COLOR : categoryStyle(p.category ?? 'OTHER').color,
    size: p.type === 'photospot' ? 14 : 18,
    label: p.name,
    selected: current?.key === p.key,
    onClick: () => show(p.key)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [shown, current?.key, places])

  const onScroll = () => {
    const el = track.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index) setIndex(i)
  }

  const hoursLine = (hours: unknown) => {
    const h = parseHours(hours)
    if (!h) return null
    const s = openState(h)
    if (s.open && s.detail) return t('m.xd.openTill', { time: formatTime(s.detail.time) })
    if (!s.open && s.detail && s.detail.dayOffset === 0) return t('m.xd.opensAt', { time: formatTime(s.detail.time) })
    return t('m.xd.closedNow')
  }
  const hrefOf = (p: Place) => (p.type === 'vendor' ? `/vendor/${p.id}?from=experiences` : p.type === 'event' ? `/events/${p.id}` : `/photospot/${p.id}`)
  const kindLine = (p: Place) => (p.type === 'vendor' ? labels.category(p.category ?? '') : p.type === 'event' ? when(p.startAt!) : t('m.exp.photoSpot'))

  return (
    <main style={{ position: 'fixed', inset: 0, background: 'var(--system-bg)', overflow: 'hidden' }}>
      <EtaMap
        key={city}
        live
        detailed
        labelsFromZoom={15.5}
        center={{ lat: town.lat, lng: town.lng }}
        zoom={14}
        fitTo={[{ lat: town.lat, lng: town.lng }]}
        markers={markers}
        onPosition={onPosition}
        bottomInset={current ? CARD_INSET : 0}
        label={t('m.xd.nearby')}
      />

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 500, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}><PlanDiscoverSwitch mode={mode} onChange={onModeChange} floating /></div>
        <Link href="/explore" onClick={() => triggerHaptic('medium')} style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px', minHeight: '44px', padding: '0 14px', borderRadius: '999px', background: '#0E1220', color: 'white', boxShadow: 'var(--shadow-elevated)', fontSize: '14px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          <Icon name="compass" size={16} style={{ color: 'var(--gold)' }} /> {t('m.ex.open')}
        </Link>
      </div>
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 68px)', left: '16px', zIndex: 500 }}>
        <button onClick={() => { triggerHaptic('light'); setFiltersOpen(true) }} aria-label={t('m.xd.filters')} aria-pressed={Boolean(category)} style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: category ? 'var(--rum)' : 'var(--system-bg-elevated)', color: category ? 'white' : 'var(--label-primary)', boxShadow: 'var(--shadow-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <Icon name="filter" size={18} />
        </button>
      </div>

      {/* One place at a time; swipe for the next nearest */}
      {current && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(62px + env(safe-area-inset-bottom, 0px))', zIndex: 500 }}>
          <div ref={track} onScroll={onScroll} className="snap-carousel" aria-roledescription="carousel" aria-label={t('m.xd.nearby')} style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
            {places.map((p, i) => {
              const nav = directionsUrl({ lat: p.lat, lng: p.lng }, pos && p.km <= MAX_WALK_KM ? 'walking' : 'driving')
              const line = [kindLine(p), pos ? formatDistance(p.km) : null, p.type === 'vendor' ? hoursLine(p.hours) : null].filter(Boolean).join(' · ')
              return (
                <section key={p.key} aria-roledescription="slide" aria-label={`${i + 1} / ${places.length}: ${p.name}`} style={{ flex: '0 0 100%', scrollSnapAlign: 'center', padding: '0 16px', boxSizing: 'border-box' }}>
                  <div className="card" style={{ padding: '12px', cursor: 'default', boxShadow: 'var(--shadow-elevated)' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <span style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}>
                        {p.image ? <Img src={p.image} alt="" width={128} height={128} sizes="64px" /> : <Icon name={p.type === 'event' ? 'party' : p.type === 'photospot' ? 'camera' : 'mapPin'} size={22} />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                        <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {nav && <a href={nav} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}><Icon name="navigate" size={16} /> {t('m.xd.go')}</a>}
                      <Link href={hrefOf(p)} onClick={() => triggerHaptic('light')} className="btn btn-primary" style={{ flex: 1, textDecoration: 'none' }}>{t('m.common.view')}</Link>
                    </div>
                  </div>
                </section>
              )
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className={`bottom-sheet-overlay ${filtersOpen ? 'open' : ''}`} onClick={() => setFiltersOpen(false)} />
      <div className={`bottom-sheet ${filtersOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!filtersOpen} aria-label={t('m.xd.filters')}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.xd.filters')}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[null, ...CATEGORIES].map(c => (
              <button key={c ?? 'all'} className={`chip ${category === c ? 'active' : ''}`} aria-pressed={category === c} onClick={() => { triggerHaptic('selection'); setCategory(c); setFiltersOpen(false) }}>
                {c === null ? t('m.xd.allPlaces') : c === 'EVENTS' ? t('m.events.eyebrow') : labels.category(c)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Dock />
    </main>
  )
}
