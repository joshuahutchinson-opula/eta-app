// components/web/DiscoverMap.tsx — the Discover subtab: a full-screen dark
// Mapbox map with vendors, experiences and photo spots always pinned, Hidden
// Gems fogged until you're near them, a heading-aware location puck, and the
// flows to submit a gem and confirm one you've found.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Map as MapboxMap, Marker, GeoJSONSource, MapMouseEvent } from 'mapbox-gl'
import { getAuthToken, getCurrentUser } from '@/lib/auth-client'
import { GEM_CATEGORIES, GEM_CATEGORY_LABELS, REVEAL_RADIUS_M, VERIFY_THRESHOLD, type GemCategoryKey } from '@/lib/hidden-gems'
import type { GemView } from '@/app/api/gems/route'

export interface DiscoverVendor { id: string; name: string; category: string; neighborhood: string; lat: number; lng: number; image: string | null; rating: number | null; reviewCount: number }
export interface DiscoverExperience { id: string; name: string; tagline: string; price: number; lat: number; lng: number; image: string; stopCount: number }
export interface DiscoverSpot { id: string; name: string; bestTime: string; lat: number; lng: number; image: string }

type Layer = 'vendors' | 'experiences' | 'spots' | 'gems'
type Selected =
  | { kind: 'vendor'; item: DiscoverVendor }
  | { kind: 'experience'; item: DiscoverExperience }
  | { kind: 'spot'; item: DiscoverSpot }
  | { kind: 'gem'; item: GemView }

interface Position { lat: number; lng: number; accuracy: number }

const NEGRIL: [number, number] = [-78.3485, 18.2935]

const LAYERS: Array<{ key: Layer; label: string; color: string; icon: string }> = [
  { key: 'vendors', label: 'Vendors', color: '#D43A2A', icon: '<path d="M4 10h16l-1.5-5h-13z"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/>' },
  { key: 'experiences', label: 'Experiences', color: '#0EA5A4', icon: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/>' },
  { key: 'spots', label: 'Photo spots', color: '#E0A100', icon: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>' },
  { key: 'gems', label: 'Hidden gems', color: '#8B5CF6', icon: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 18 3-18"/>' }
]
const LAYER = Object.fromEntries(LAYERS.map(l => [l.key, l])) as Record<Layer, (typeof LAYERS)[number]>

function pinElement(layer: Layer, title: string, extraClass = ''): HTMLDivElement {
  const el = document.createElement('div')
  el.className = `dm-pin ${extraClass}`
  el.style.setProperty('--pin', LAYER[layer].color)
  el.setAttribute('role', 'button')
  el.setAttribute('tabindex', '0')
  el.setAttribute('aria-label', title)
  el.title = title
  el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${LAYER[layer].icon}</svg>`
  return el
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)))
}

// Fog clouds: ~1.2 km across at any zoom (metres → pixels at Negril's latitude).
const FOG_RADIUS: mapboxgl.ExpressionSpecification = ['interpolate', ['exponential', 2], ['zoom'], 8, 2, 10, 8, 12, 32, 14, 129, 16, 515, 18, 2060]

export default function DiscoverMap({ token, vendors, experiences, spots }: { token: string; vendors: DiscoverVendor[]; experiences: DiscoverExperience[]; spots: DiscoverSpot[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null)
  const markersRef = useRef<Record<Layer, Marker[]>>({ vendors: [], experiences: [], spots: [], gems: [] })
  const puckRef = useRef<Marker | null>(null)
  const draftRef = useRef<Marker | null>(null)
  const lastFetchRef = useRef<{ lat: number; lng: number; at: number } | null>(null)
  const followRef = useRef(false)
  const headingRef = useRef<number | null>(null)

  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState<Record<Layer, boolean>>({ vendors: true, experiences: true, spots: true, gems: true })
  const [position, setPosition] = useState<Position | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const [follow, setFollow] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  const [gems, setGems] = useState<GemView[]>([])
  const [fog, setFog] = useState<Array<{ lat: number; lng: number; count: number }>>([])
  const [selected, setSelected] = useState<Selected | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)
  const [pickingPin, setPickingPin] = useState(false)
  const [draft, setDraft] = useState<{ name: string; category: GemCategoryKey | ''; description: string; files: File[]; loc: 'gps' | 'pin'; pin: { lat: number; lng: number } | null }>({ name: '', category: '', description: '', files: [], loc: 'gps', pin: null })
  const [formError, setFormError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [signedIn, setSignedIn] = useState(false)

  useEffect(() => { setSignedIn(Boolean(getCurrentUser() && getAuthToken())) }, [])
  useEffect(() => { followRef.current = follow }, [follow])

  const authHeaders = (): Record<string, string> => {
    const tokenValue = getAuthToken()
    return tokenValue ? { Authorization: `Bearer ${tokenValue}` } : {}
  }

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  // ---- Map setup -------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current) return
      mapboxgl.accessToken = token
      mapboxRef.current = mapboxgl
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: NEGRIL,
        zoom: 12.6,
        pitch: 0,
        attributionControl: true
      })
      map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'bottom-right')
      mapRef.current = map
      map.on('load', () => {
        map.addSource('gem-fog', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({
          id: 'gem-fog',
          type: 'circle',
          source: 'gem-fog',
          paint: { 'circle-radius': FOG_RADIUS, 'circle-color': '#B9B4D6', 'circle-opacity': 0.28, 'circle-blur': 0.9 }
        })
        map.addSource('me-range', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
        map.addLayer({
          id: 'me-range',
          type: 'circle',
          source: 'me-range',
          // The reveal radius (750 m) around you.
          paint: { 'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 10, 5, 12, 20, 14, 81, 16, 322, 18, 1288], 'circle-color': '#8B5CF6', 'circle-opacity': 0.06, 'circle-stroke-color': '#8B5CF6', 'circle-stroke-opacity': 0.35, 'circle-stroke-width': 1 }
        })
        setReady(true)
      })
      // Dragging the map by hand ends follow mode, like Waze.
      map.on('dragstart', () => setFollow(false))
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [token])

  // ---- Always-visible pins ---------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!ready || !map || !mapboxgl) return
    const add = (layer: Layer, lat: number, lng: number, title: string, onClick: () => void) => {
      const el = pinElement(layer, title)
      el.addEventListener('click', e => { e.stopPropagation(); onClick() })
      el.addEventListener('keydown', e => { if (e.key === 'Enter') onClick() })
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(map)
      markersRef.current[layer].push(marker)
    }
    vendors.forEach(v => add('vendors', v.lat, v.lng, v.name, () => setSelected({ kind: 'vendor', item: v })))
    experiences.forEach(x => add('experiences', x.lat, x.lng, x.name, () => setSelected({ kind: 'experience', item: x })))
    spots.forEach(s => add('spots', s.lat, s.lng, s.name, () => setSelected({ kind: 'spot', item: s })))
    return () => {
      for (const layer of ['vendors', 'experiences', 'spots'] as Layer[]) {
        markersRef.current[layer].forEach(m => m.remove())
        markersRef.current[layer] = []
      }
    }
  }, [ready, vendors, experiences, spots])

  // ---- Gems: fetched for where you are; fog for the rest -----------------
  const fetchGems = useCallback(async (pos: Position | null) => {
    const qs = pos ? `?lat=${pos.lat}&lng=${pos.lng}` : ''
    try {
      const res = await fetch(`/api/gems${qs}`, { headers: authHeaders() })
      if (!res.ok) return
      const data = await res.json()
      setGems(data.revealed ?? [])
      setFog(data.fog ?? [])
      if (pos) lastFetchRef.current = { lat: pos.lat, lng: pos.lng, at: Date.now() }
    } catch {
      // keep what we have
    }
  }, [])

  useEffect(() => { fetchGems(null) }, [fetchGems])

  useEffect(() => {
    if (!position) return
    const last = lastFetchRef.current
    if (!last || metres(last, position) > 100 || Date.now() - last.at > 60000) fetchGems(position)
  }, [position, fetchGems])

  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!ready || !map || !mapboxgl) return
    ;(map.getSource('gem-fog') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: fog.map(f => ({ type: 'Feature', properties: { count: f.count }, geometry: { type: 'Point', coordinates: [f.lng, f.lat] } }))
    })
    markersRef.current.gems.forEach(m => m.remove())
    markersRef.current.gems = gems.map(g => {
      const el = pinElement('gems', g.name, `dm-pin-gem ${g.status === 'PENDING' ? 'dm-pin-pending' : ''}`)
      el.addEventListener('click', e => { e.stopPropagation(); setSelected({ kind: 'gem', item: g }) })
      return new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([g.lng, g.lat]).addTo(map)
    })
    if (!visible.gems) markersRef.current.gems.forEach(m => { m.getElement().style.display = 'none' })
  }, [ready, gems, fog]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Layer toggles -----------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    for (const layer of Object.keys(visible) as Layer[]) {
      markersRef.current[layer].forEach(m => { m.getElement().style.display = visible[layer] ? '' : 'none' })
    }
    if (ready && map?.getLayer('gem-fog')) map.setLayoutProperty('gem-fog', 'visibility', visible.gems ? 'visible' : 'none')
  }, [visible, ready])

  // ---- Location puck with heading ---------------------------------------
  const onOrientation = useCallback((e: DeviceOrientationEvent) => {
    const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
    const h = typeof ios === 'number' ? ios : e.absolute && e.alpha !== null ? 360 - e.alpha : null
    if (h !== null) { headingRef.current = h; setHeading(h) }
  }, [])

  const startLocating = async () => {
    setLocError(null)
    if (!('geolocation' in navigator)) { setLocError('This browser can’t share your location.'); return }
    // iOS asks for compass access separately, and only from a tap.
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    if (typeof DOE?.requestPermission === 'function') {
      try { if ((await DOE.requestPermission()) === 'granted') window.addEventListener('deviceorientation', onOrientation) } catch {}
    } else {
      window.addEventListener('deviceorientationabsolute', onOrientation as EventListener)
      window.addEventListener('deviceorientation', onOrientation)
    }
    navigator.geolocation.watchPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
        setPosition(p)
        // No compass (most laptops): use GPS course while moving.
        if (headingRef.current === null && pos.coords.heading !== null && (pos.coords.speed ?? 0) > 0.5) setHeading(pos.coords.heading)
      },
      err => setLocError(err.code === 1 ? 'Location is blocked — allow it in your browser to find gems near you.' : 'Couldn’t get your location.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    )
    setFollow(true)
  }

  useEffect(() => () => {
    window.removeEventListener('deviceorientation', onOrientation)
    window.removeEventListener('deviceorientationabsolute', onOrientation as EventListener)
  }, [onOrientation])

  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!ready || !map || !mapboxgl || !position) return
    if (!puckRef.current) {
      const el = document.createElement('div')
      el.className = 'dm-puck'
      el.innerHTML = '<span class="dm-puck-cone"></span><span class="dm-puck-dot"></span>'
      puckRef.current = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([position.lng, position.lat]).addTo(map)
    }
    puckRef.current.setLngLat([position.lng, position.lat])
    puckRef.current.getElement().classList.toggle('dm-puck-has-heading', heading !== null)
    if (heading !== null) puckRef.current.setRotation(heading)
    ;(map.getSource('me-range') as GeoJSONSource | undefined)?.setData({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [position.lng, position.lat] } })
    // Follow mode keeps you centred with the map turned to your heading.
    if (followRef.current) map.easeTo({ center: [position.lng, position.lat], bearing: heading ?? map.getBearing(), zoom: Math.max(map.getZoom(), 15), duration: 600 })
  }, [ready, position, heading])

  // ---- Dropping a pin for a new gem -------------------------------------
  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!ready || !map || !mapboxgl || !pickingPin) return
    map.getCanvas().style.cursor = 'crosshair'
    const onClick = (e: MapMouseEvent) => {
      const pin = { lat: e.lngLat.lat, lng: e.lngLat.lng }
      setDraft(d => ({ ...d, pin, loc: 'pin' }))
      setPickingPin(false)
      setShowSubmit(true)
    }
    map.once('click', onClick)
    return () => { map.off('click', onClick); map.getCanvas().style.cursor = '' }
  }, [ready, pickingPin])

  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = mapboxRef.current
    if (!ready || !map || !mapboxgl) return
    draftRef.current?.remove()
    draftRef.current = null
    if (showSubmit && draft.loc === 'pin' && draft.pin) {
      const el = pinElement('gems', 'New gem location', 'dm-pin-draft')
      const marker = new mapboxgl.Marker({ element: el, draggable: true }).setLngLat([draft.pin.lng, draft.pin.lat]).addTo(map)
      marker.on('dragend', () => { const ll = marker.getLngLat(); setDraft(d => ({ ...d, pin: { lat: ll.lat, lng: ll.lng } })) })
      draftRef.current = marker
    }
  }, [ready, showSubmit, draft.loc, draft.pin])

  // ---- Actions -----------------------------------------------------------
  const submitGem = async () => {
    setFormError(null)
    const loc = draft.loc === 'gps' ? position : draft.pin
    if (!draft.name.trim() || !draft.category || draft.description.trim().length < 10) { setFormError('Add a name, a category and a sentence or two about it.'); return }
    if (draft.files.length === 0) { setFormError('Add at least one photo.'); return }
    if (!loc) { setFormError(draft.loc === 'gps' ? 'Turn on your location first, or drop a pin instead.' : 'Drop a pin on the map.'); return }
    const form = new FormData()
    form.set('name', draft.name.trim())
    form.set('category', draft.category)
    form.set('description', draft.description.trim())
    form.set('lat', String(loc.lat))
    form.set('lng', String(loc.lng))
    draft.files.slice(0, 4).forEach(f => form.append('photos', f))
    setSubmitting(true)
    try {
      const res = await fetch('/api/gems', { method: 'POST', headers: authHeaders(), body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
      setGems(prev => [data.gem, ...prev])
      setShowSubmit(false)
      setDraft({ name: '', category: '', description: '', files: [], loc: 'gps', pin: null })
      setSelected({ kind: 'gem', item: data.gem })
      flash(`Submitted! It shows as pending until ${VERIFY_THRESHOLD} explorers confirm it in person.`)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setSubmitting(false)
    }
  }

  const confirmGem = async (gem: GemView) => {
    if (!position) { flash('Turn on your location to confirm.'); return }
    setConfirming(true)
    try {
      const res = await fetch(`/api/gems/${gem.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ lat: position.lat, lng: position.lng, accuracy: position.accuracy })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Sumth nah wuk')
      const updated: GemView = { ...gem, confirmedByMe: true, confirmationCount: data.confirmationCount, status: data.status }
      setGems(prev => prev.map(g => (g.id === gem.id ? updated : g)))
      setSelected({ kind: 'gem', item: updated })
      flash(data.verifiedNow ? `+${data.pointsAwarded} pts — and your find just verified this gem!` : `+${data.pointsAwarded} pts for finding ${gem.name}`)
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Sumth nah wuk')
    } finally {
      setConfirming(false)
    }
  }

  // ---- Panel -------------------------------------------------------------
  const renderSelected = () => {
    if (!selected) return null
    const close = <button className="dm-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
    if (selected.kind === 'gem') {
      const g = selected.item
      const dist = position ? metres(position, g) : null
      const inRange = dist !== null && dist <= REVEAL_RADIUS_M
      return (
        <div className="dm-panel">
          {close}
          {g.photos[0] ? <img className="dm-panel-img" src={g.photos[0]} alt={g.name} /> : null}
          <p className="dm-kicker" style={{ color: LAYER.gems.color }}>◆ {GEM_CATEGORY_LABELS[g.category]}{g.status === 'PENDING' ? ' · pending' : ' · verified'}</p>
          <h3>{g.name}</h3>
          <p className="dm-body">{g.description}</p>
          {g.photos.length > 1 ? (
            <div className="dm-thumbs">{g.photos.slice(1).map(p => <img key={p} src={p} alt="" />)}</div>
          ) : null}
          {g.status === 'PENDING' ? (
            <div className="dm-progress" aria-label={`${g.confirmationCount} of ${g.threshold} confirmations`}>
              <span style={{ width: `${Math.min(100, (g.confirmationCount / g.threshold) * 100)}%` }} />
            </div>
          ) : null}
          <p className="dm-meta">
            {g.status === 'PENDING' ? `${g.confirmationCount} of ${g.threshold} in-person confirmations` : 'Verified by explorers on the ground'}
            {dist !== null ? ` · ${dist < 1000 ? `${dist} m` : `${(dist / 1000).toFixed(1)} km`} away` : ''}
          </p>
          {g.isMine ? (
            <p className="dm-note">You found this one. {g.status === 'PENDING' ? 'You’ll get a bonus when it’s verified.' : ''}</p>
          ) : g.confirmedByMe ? (
            <p className="dm-note">✓ You’ve confirmed this find.</p>
          ) : !signedIn ? (
            <Link href="/login" className="w-btn w-btn-primary w-btn-block">Log in to confirm</Link>
          ) : inRange ? (
            <button className="w-btn w-btn-primary w-btn-block" onClick={() => confirmGem(g)} disabled={confirming}>
              {confirming ? 'Checking your location…' : 'Confirm you found this'}
            </button>
          ) : (
            <p className="dm-note">Get within {REVEAL_RADIUS_M} m to confirm it.</p>
          )}
        </div>
      )
    }
    if (selected.kind === 'vendor') {
      const v = selected.item
      return (
        <div className="dm-panel">
          {close}
          {v.image ? <img className="dm-panel-img" src={v.image} alt={v.name} /> : null}
          <p className="dm-kicker" style={{ color: LAYER.vendors.color }}>Vendor · {v.neighborhood}</p>
          <h3>{v.name}</h3>
          <p className="dm-meta">{v.rating !== null ? `★ ${v.rating.toFixed(1)} (${v.reviewCount})` : 'New on ETA'}</p>
          <Link href={`/web/vendor/${v.id}`} className="w-btn w-btn-primary w-btn-block">View vendor</Link>
        </div>
      )
    }
    if (selected.kind === 'experience') {
      const x = selected.item
      return (
        <div className="dm-panel">
          {close}
          {x.image ? <img className="dm-panel-img" src={x.image} alt={x.name} /> : null}
          <p className="dm-kicker" style={{ color: LAYER.experiences.color }}>Experience · {x.stopCount} stops · starts here</p>
          <h3>{x.name}</h3>
          <p className="dm-body">{x.tagline}</p>
          <p className="dm-meta">${Math.round(x.price)} per person</p>
          <Link href={`/web/experiences/${x.id}`} className="w-btn w-btn-primary w-btn-block">See the route</Link>
        </div>
      )
    }
    const s = selected.item
    return (
      <div className="dm-panel">
        {close}
        <img className="dm-panel-img" src={s.image} alt={s.name} />
        <p className="dm-kicker" style={{ color: LAYER.spots.color }}>Photo spot · best at {s.bestTime}</p>
        <h3>{s.name}</h3>
        <Link href={`/web/photo-spots/${s.id}`} className="w-btn w-btn-primary w-btn-block">Open photo spot</Link>
      </div>
    )
  }

  const nearbyHidden = fog.reduce((n, f) => n + f.count, 0)

  return (
    <div className="dm-root">
      <div ref={containerRef} className="dm-map" />

      <div className="dm-toolbar">
        <div className="dm-layers" role="group" aria-label="Show on map">
          {LAYERS.map(l => (
            <button
              key={l.key}
              className="dm-chip"
              aria-pressed={visible[l.key]}
              style={{ ['--pin' as string]: l.color }}
              onClick={() => setVisible(v => ({ ...v, [l.key]: !v[l.key] }))}
            >
              <span className="dm-chip-dot" /> {l.label}
            </button>
          ))}
        </div>
        {nearbyHidden > 0 ? <p className="dm-fog-hint">{nearbyHidden} hidden {nearbyHidden === 1 ? 'gem is' : 'gems are'} out there under the fog — get within {REVEAL_RADIUS_M} m to reveal {nearbyHidden === 1 ? 'it' : 'them'}.</p> : null}
      </div>

      <div className="dm-actions">
        <button className="dm-fab" onClick={() => (position ? setFollow(f => !f) : startLocating())} aria-pressed={follow} title={position ? (follow ? 'Stop following' : 'Follow me') : 'Show my location'}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill={follow ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 2l7 19-7-4-7 4z" /></svg>
        </button>
        <button className="w-btn w-btn-primary" onClick={() => { setSelected(null); setShowSubmit(true) }}>
          + Add a hidden gem
        </button>
      </div>

      {locError ? <p className="dm-toast dm-toast-error" role="alert">{locError}</p> : null}
      {toast ? <p className="dm-toast" role="status">{toast}</p> : null}
      {pickingPin ? <p className="dm-toast" role="status">Tap the map where the gem is.</p> : null}

      {showSubmit ? (
        <div className="dm-panel dm-panel-form">
          <button className="dm-close" onClick={() => setShowSubmit(false)} aria-label="Close">×</button>
          <p className="dm-kicker" style={{ color: LAYER.gems.color }}>◆ New hidden gem</p>
          <h3>Share a secret spot</h3>
          {!signedIn ? (
            <>
              <p className="dm-body">Secret rivers, hot springs, old ruins — log in to add one. It stays hidden on everyone’s map until they’re close.</p>
              <Link href="/login" className="w-btn w-btn-primary w-btn-block">Log in</Link>
            </>
          ) : (
            <form onSubmit={e => { e.preventDefault(); submitGem() }} className="dm-form">
              <label>Name<input value={draft.name} maxLength={80} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. The blue pool behind Orange Hill" /></label>
              <label>Category
                <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value as GemCategoryKey }))}>
                  <option value="">Choose…</option>
                  {GEM_CATEGORIES.map(c => <option key={c} value={c}>{GEM_CATEGORY_LABELS[c]}</option>)}
                </select>
              </label>
              <label>What is it, and how do you get there?<textarea value={draft.description} maxLength={1000} rows={3} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} /></label>
              <label>Photos (1–4)<input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={e => setDraft(d => ({ ...d, files: Array.from(e.target.files ?? []).slice(0, 4) }))} /></label>
              <fieldset className="dm-loc">
                <legend>Location</legend>
                <label><input type="radio" checked={draft.loc === 'gps'} onChange={() => { setDraft(d => ({ ...d, loc: 'gps' })); if (!position) startLocating() }} /> I’m here now {position ? `(±${Math.round(position.accuracy)} m)` : ''}</label>
                <label><input type="radio" checked={draft.loc === 'pin'} onChange={() => { setShowSubmit(false); setPickingPin(true) }} /> Drop a pin {draft.pin && draft.loc === 'pin' ? '(set — drag to adjust)' : ''}</label>
              </fieldset>
              {formError ? <p className="dm-error" role="alert">{formError}</p> : null}
              <button type="submit" className="w-btn w-btn-primary w-btn-block" disabled={submitting}>{submitting ? 'Uploading…' : 'Submit gem'}</button>
            </form>
          )}
        </div>
      ) : renderSelected()}
    </div>
  )
}
