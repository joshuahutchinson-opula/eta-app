// components/experiences/DiscoverView.tsx — Discover: a live, Waze-style map
// of the region (follows you heading-up; components/map/EtaMap) under a fog
// of war that clears where you've been and at places you've discovered, one
// place card at a time (swipe for the next nearest), and category filters
// behind a button. Hidden gems stay under the fog until you're close.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Dock from '@/components/Dock'
import EtaMap, { type MapMarker, type MapPoint } from '@/components/map/EtaMap'
import { AddGemSheet, GemDetailSheet, useHiddenGems, type GemDetail } from '@/components/HiddenGems'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { triggerHaptic } from '@/lib/haptics'
import { formatDistance } from '@/lib/geo'
import { haversineKm, MAX_WALK_KM } from '@/lib/routing'
import { directionsUrl } from '@/lib/calendar'
import { formatTime, openState, parseHours } from '@/lib/hours'
import { DISCOVERY_POINTS } from '@/lib/checkins'
import { apiJson } from '@/lib/api-client'
import { getCurrentUser } from '@/lib/auth-client'
import { categoryStyle } from '@/lib/vendor-style'
import { markExplored, readExplored } from '@/lib/explored'
import type { MapPhotoSpot, MapVendor } from '@/lib/map-types'
import type { PlanAnchor } from '@/lib/plan'
import PlanDiscoverSwitch, { type TabMode } from './PlanDiscoverSwitch'

const CATEGORIES = ['FOOD', 'DRINKS', 'ACTIVITY', 'WELLNESS', 'BEACH']
// How much ground the fog covers around the town, in degrees.
const FOG_SPAN = { lat: 0.18, lng: 0.22 }
// The place card sits over the bottom of the map.
const CARD_INSET = 200

interface Place {
  key: string
  type: 'vendor' | 'photospot'
  id: string
  name: string
  image: string | null
  category: string | null
  hours: unknown
  lat: number
  lng: number
}

interface DiscoveryRow { vendorId: string | null; photoSpotId: string | null }

export default function DiscoverView({ vendors, photoSpots, mode, onModeChange, onPlanAround }: {
  vendors: MapVendor[]
  photoSpots: MapPhotoSpot[]
  mode: TabMode
  onModeChange: (m: TabMode) => void
  onPlanAround: (anchor: PlanAnchor) => void
}) {
  const { t } = useLang()
  const labels = useLabels()
  const { city, town } = useRegion()
  const [pos, setPos] = useState<(MapPoint & { accuracy: number }) | null>(null)
  const [explored, setExplored] = useState<MapPoint[]>([])
  const gems = useHiddenGems(pos, true)
  useEffect(() => { setExplored(readExplored()) }, [])
  // Each fix clears the fog where you are; re-sorting waits for ~100 m of movement.
  const onPosition = useCallback((p: MapPoint & { accuracy: number }) => {
    setPos(prev => (prev && haversineKm(prev, p) < 0.05 ? prev : p))
    if (p.accuracy <= 150 && markExplored(p)) setExplored(readExplored())
  }, [])
  const [selectedGem, setSelectedGem] = useState<GemDetail | null>(null)
  const [addingGem, setAddingGem] = useState(false)
  const [category, setCategory] = useState<string | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  // null = signed out (we can't know what's new to you).
  const [found, setFound] = useState<Set<string> | null>(null)
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!getCurrentUser()) return
    apiJson<DiscoveryRow[]>('/api/discoveries')
      .then(rows => setFound(new Set(rows.flatMap(r => [r.vendorId && `vendor:${r.vendorId}`, r.photoSpotId && `photospot:${r.photoSpotId}`].filter((k): k is string => Boolean(k))))))
      .catch(() => setFound(null))
  }, [])

  const regionVendors = useMemo(() => vendors.filter(v => !v.city || v.city === city), [vendors, city])
  const regionSpots = useMemo(() => photoSpots.filter(s => !s.city || s.city === city), [photoSpots, city])
  const allPlaces: Place[] = useMemo(() => [
    ...regionVendors.map(v => ({ key: `vendor:${v.id}`, type: 'vendor' as const, id: v.id, name: v.name, image: v.images?.[0] ?? null, category: v.category, hours: v.hours, lat: v.lat, lng: v.lng })),
    ...regionSpots.map(s => ({ key: `photospot:${s.id}`, type: 'photospot' as const, id: s.id, name: s.name, image: s.officialPhoto ?? null, category: null, hours: null, lat: s.lat, lng: s.lng }))
  ], [regionVendors, regionSpots])

  // Nearest first: from you, or the town centre until we have your position.
  const from = pos ?? { lat: town.lat, lng: town.lng }
  const places = useMemo(() => allPlaces
    .filter(p => !category || p.category === category)
    .map(p => ({ ...p, km: haversineKm(from, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 30),
  // Re-sort when you've moved ~100 m, not on every GPS tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [allPlaces, category, Math.round(from.lat * 1000), Math.round(from.lng * 1000)])

  useEffect(() => { setIndex(0); track.current?.scrollTo({ left: 0 }) }, [category, city])

  const discovered = found ? allPlaces.filter(p => found.has(p.key)).length : 0
  const pct = allPlaces.length ? Math.round((discovered / allPlaces.length) * 100) : 0

  const current = places[Math.min(index, Math.max(0, places.length - 1))]

  // Fog of war: lifted where you've walked and at every place you've discovered.
  const fog = useMemo(() => ({
    bounds: { west: town.lng - FOG_SPAN.lng, east: town.lng + FOG_SPAN.lng, south: town.lat - FOG_SPAN.lat, north: town.lat + FOG_SPAN.lat },
    explored: [...explored, ...allPlaces.filter(p => found?.has(p.key)), ...(pos ? [pos] : [])],
    radiusM: 400
  }), [town.lat, town.lng, explored, allPlaces, found, pos])

  const markers: MapMarker[] = useMemo(() => [
    ...regionVendors.filter(v => !category || v.category === category).map(v => ({
      id: `v-${v.id}`, lat: v.lat, lng: v.lng, color: categoryStyle(v.category).color, ring: v.isPremium ? '#FFB800' : '#FFFFFF',
      size: v.isPremium ? 20 : 16, label: v.name, selected: current?.id === v.id, onClick: () => show(v.id)
    })),
    ...(category ? [] : regionSpots).map(s => ({
      id: `s-${s.id}`, lat: s.lat, lng: s.lng, color: '#FFB800', size: 14, label: s.name, selected: current?.id === s.id, onClick: () => show(s.id)
    })),
    ...gems.gems.map(g => ({
      id: `g-${g.id}`, lat: g.lat, lng: g.lng, color: g.status === 'VERIFIED' ? '#AF52DE' : '#D1A3EC', size: 18, dashed: g.status === 'PENDING', label: g.name,
      onClick: () => { triggerHaptic('light'); setSelectedGem(g) }
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [regionVendors, regionSpots, category, current?.id, gems.gems])
  const onScroll = () => {
    const el = track.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index) setIndex(i)
  }
  const show = (id: string) => {
    const i = places.findIndex(p => p.id === id)
    const el = track.current
    if (i === -1 || !el) return
    triggerHaptic('light')
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const hoursLine = (hours: unknown) => {
    const h = parseHours(hours)
    if (!h) return null
    const s = openState(h)
    if (s.open && s.detail) return t('m.xd.openTill', { time: formatTime(s.detail.time) })
    if (!s.open && s.detail && s.detail.dayOffset === 0) return t('m.xd.opensAt', { time: formatTime(s.detail.time) })
    return t('m.xd.closedNow')
  }

  const floatBtn = (icon: string, label: string, onClick: () => void, active = false) => (
    <button onClick={onClick} aria-label={label} aria-pressed={active} style={{ width: '44px', height: '44px', borderRadius: '50%', border: 'none', background: active ? 'var(--rum)' : 'var(--system-bg-elevated)', color: active ? 'white' : 'var(--label-primary)', boxShadow: 'var(--shadow-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      <Icon name={icon} size={18} />
    </button>
  )

  return (
    <main style={{ position: 'fixed', inset: 0, background: 'var(--system-bg)', overflow: 'hidden' }}>
      <EtaMap
        key={city}
        live
        center={{ lat: town.lat, lng: town.lng }}
        zoom={14}
        fitTo={[{ lat: town.lat, lng: town.lng }]}
        markers={markers}
        fog={fog}
        onPosition={onPosition}
        bottomInset={current ? CARD_INSET : 0}
        label={t('m.xd.nearby')}
      />

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 500, padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}><PlanDiscoverSwitch mode={mode} onChange={onModeChange} floating /></div>
        {found && allPlaces.length > 0 && (
          <span role="status" className="num-font" style={{ pointerEvents: 'auto', padding: '10px 14px', borderRadius: '999px', background: 'var(--system-bg-elevated)', boxShadow: 'var(--shadow-elevated)', fontSize: '13px', fontWeight: 700, color: 'var(--label-primary)', whiteSpace: 'nowrap' }}>
            {t('m.xd.explored', { pct, town: town.name })}
          </span>
        )}
      </div>
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 68px)', left: '16px', zIndex: 500, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {floatBtn('filter', t('m.xd.filters'), () => { triggerHaptic('light'); setFiltersOpen(true) }, Boolean(category))}
        {floatBtn('plus', t('m.gems.addShort'), () => { triggerHaptic('light'); setAddingGem(true) })}
      </div>

      {/* One place at a time; swipe for the next nearest */}
      {current && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(62px + env(safe-area-inset-bottom, 0px))', zIndex: 500 }}>
          <div ref={track} onScroll={onScroll} className="snap-carousel" aria-roledescription="carousel" aria-label={t('m.xd.nearby')} style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory' }}>
            {places.map((p, i) => {
              const isNew = found !== null && !found.has(p.key)
              const nav = directionsUrl({ lat: p.lat, lng: p.lng }, pos && p.km <= MAX_WALK_KM ? 'walking' : 'driving')
              const line = [p.type === 'vendor' ? labels.category(p.category ?? '') : t('m.exp.photoSpot'), pos ? formatDistance(p.km) : null, p.type === 'vendor' ? hoursLine(p.hours) : null].filter(Boolean).join(' · ')
              return (
                <section key={p.key} aria-roledescription="slide" aria-label={`${i + 1} / ${places.length}: ${p.name}`} style={{ flex: '0 0 100%', scrollSnapAlign: 'center', padding: '0 16px', boxSizing: 'border-box' }}>
                  <div className="card" style={{ padding: '12px', cursor: 'default', boxShadow: 'var(--shadow-elevated)' }}>
                    <Link href={p.type === 'vendor' ? `/vendor/${p.id}?from=experiences` : `/photospot/${p.id}`} style={{ display: 'flex', gap: '12px', textDecoration: 'none' }}>
                      <span style={{ width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)' }}>
                        {p.image && <Img src={p.image} alt="" width={144} height={144} sizes="72px" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '17px', fontWeight: 700, color: 'var(--label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                        <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</span>
                        {isNew && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}><Icon name="sparkle" size={12} /> {t('m.xd.newToYou', { n: DISCOVERY_POINTS[p.type] })}</span>}
                      </span>
                    </Link>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {nav && <a href={nav} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }}><Icon name="navigate" size={16} /> {t('m.xd.go')}</a>}
                      <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); onPlanAround({ type: p.type, id: p.id, name: p.name }) }} style={{ flex: 1.4 }}>{t('m.xd.planAround')}</button>
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
                {c ? labels.category(c) : t('m.xd.allPlaces')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <GemDetailSheet gem={selectedGem} pos={pos} onClose={() => setSelectedGem(null)} onChanged={gems.reload} />
      <AddGemSheet open={addingGem} pos={pos} onClose={() => setAddingGem(false)} onAdded={gems.reload} />
      <Dock />
    </main>
  )
}
