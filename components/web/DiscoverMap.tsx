// components/web/DiscoverMap.tsx — the Discover subtab: a full-screen dark
// Mapbox map with vendors, experiences and photo spots pinned and a
// heading-aware location puck. Hidden gems are Explore mode's secret spots
// and live only in the app's Explore mode, never here.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Map as MapboxMap, Marker } from 'mapbox-gl'

export interface DiscoverVendor { id: string; name: string; category: string; neighborhood: string; lat: number; lng: number; image: string | null; rating: number | null; reviewCount: number }
export interface DiscoverExperience { id: string; name: string; tagline: string; price: number; lat: number; lng: number; image: string; stopCount: number }
export interface DiscoverSpot { id: string; name: string; bestTime: string; lat: number; lng: number; image: string }

type Layer = 'vendors' | 'experiences' | 'spots'
type Selected =
  | { kind: 'vendor'; item: DiscoverVendor }
  | { kind: 'experience'; item: DiscoverExperience }
  | { kind: 'spot'; item: DiscoverSpot }

interface Position { lat: number; lng: number }

const NEGRIL: [number, number] = [-78.3485, 18.2935]

const LAYERS: Array<{ key: Layer; label: string; color: string; icon: string }> = [
  { key: 'vendors', label: 'Vendors', color: '#D43A2A', icon: '<path d="M4 10h16l-1.5-5h-13z"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/>' },
  { key: 'experiences', label: 'Experiences', color: '#0EA5A4', icon: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h6"/>' },
  { key: 'spots', label: 'Photo spots', color: '#E0A100', icon: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>' }
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

export default function DiscoverMap({ token, vendors, experiences, spots }: { token: string; vendors: DiscoverVendor[]; experiences: DiscoverExperience[]; spots: DiscoverSpot[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const mapboxRef = useRef<typeof import('mapbox-gl').default | null>(null)
  const markersRef = useRef<Record<Layer, Marker[]>>({ vendors: [], experiences: [], spots: [] })
  const puckRef = useRef<Marker | null>(null)
  const followRef = useRef(false)
  const headingRef = useRef<number | null>(null)

  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState<Record<Layer, boolean>>({ vendors: true, experiences: true, spots: true })
  const [position, setPosition] = useState<Position | null>(null)
  const [heading, setHeading] = useState<number | null>(null)
  const [follow, setFollow] = useState(false)
  const [locError, setLocError] = useState<string | null>(null)
  useEffect(() => { followRef.current = follow }, [follow])

  const [selected, setSelected] = useState<Selected | null>(null)

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
      map.on('load', () => setReady(true))
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

  // ---- Layer toggles -----------------------------------------------------
  useEffect(() => {
    for (const layer of Object.keys(visible) as Layer[]) {
      markersRef.current[layer].forEach(m => { m.getElement().style.display = visible[layer] ? '' : 'none' })
    }
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
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPosition(p)
        // No compass (most laptops): use GPS course while moving.
        if (headingRef.current === null && pos.coords.heading !== null && (pos.coords.speed ?? 0) > 0.5) setHeading(pos.coords.heading)
      },
      err => setLocError(err.code === 1 ? 'Location is blocked — allow it in your browser to see where you are.' : 'Couldn’t get your location.'),
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
    // Follow mode keeps you centred with the map turned to your heading.
    if (followRef.current) map.easeTo({ center: [position.lng, position.lat], bearing: heading ?? map.getBearing(), zoom: Math.max(map.getZoom(), 15), duration: 600 })
  }, [ready, position, heading])

  // ---- Panel -------------------------------------------------------------
  const renderSelected = () => {
    if (!selected) return null
    const close = <button className="dm-close" onClick={() => setSelected(null)} aria-label="Close">×</button>
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
      </div>

      <div className="dm-actions">
        <button className="dm-fab" onClick={() => (position ? setFollow(f => !f) : startLocating())} aria-pressed={follow} title={position ? (follow ? 'Stop following' : 'Follow me') : 'Show my location'}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill={follow ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M12 2l7 19-7-4-7 4z" /></svg>
        </button>
      </div>

      {locError ? <p className="dm-toast dm-toast-error" role="alert">{locError}</p> : null}

      {renderSelected()}
    </div>
  )
}
