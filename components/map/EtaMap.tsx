// components/map/EtaMap.tsx — the one map in the app (Mapbox GL, token
// NEXT_PUBLIC_MAPBOX_TOKEN). Every screen describes what it wants and this
// draws it:
//   markers   pins (colour, number, label, tap handler)
//   routes    lines through stops, drawn along real roads (/api/route → OSRM)
//   circles   dashed zones (Explore mode's "secret spot somewhere here")
//   fog       fog of war over the region, cleared where you've been
//   live      Waze-style: follows you with a smooth arrow, heading-up or
//             north-up, tilted 3D, recenter button; asks iPhone for the
//             compass once
// The ETA style is Mapbox light/dark with ETA colours, or with `detailed`
// the Mapbox Standard style (streets, road names, buildings, landmarks,
// beaches) in day/night; either follows the app's theme (html[data-theme])
// as it changes, unless `theme` pins it (Explore mode is always dark).
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { Map as MapboxMap, Marker as MapboxMarker, GeoJSONSource, CanvasSource } from 'mapbox-gl'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import type { RoadMode } from '@/lib/routing'

export interface MapPoint { lat: number; lng: number }

export interface MapMarker {
  id: string
  lat: number
  lng: number
  /** Fill colour (default ETA red). */
  color?: string
  /** Ring colour (default white). */
  ring?: string
  /** Diameter in px (default 18). */
  size?: number
  /** Short text inside the pin, e.g. a stop number. */
  text?: string
  /** Name shown on hover/selection, or always with labelAlways. */
  label?: string
  labelAlways?: boolean
  selected?: boolean
  dim?: boolean
  /** Dashed ring, e.g. a pending hidden gem. */
  dashed?: boolean
  onClick?: () => void
}

export interface MapRoute {
  id: string
  points: MapPoint[]
  mode?: RoadMode
  color?: string
  width?: number
  dashed?: boolean
}

export interface MapCircle {
  id: string
  lat: number
  lng: number
  radiusM: number
  color?: string
}

export interface MapFog {
  /** Where the traveler has been; each clears a circle. */
  explored: MapPoint[]
  /** The area the fog covers. */
  bounds: { west: number; south: number; east: number; north: number }
  radiusM?: number
}

interface Props {
  markers?: MapMarker[]
  routes?: MapRoute[]
  /** A static "you are here" dot (live mode tracks you itself). */
  user?: MapPoint | null
  center?: MapPoint
  zoom?: number
  /** Points to keep in view; defaults to the markers, routes and user. */
  fitTo?: MapPoint[]
  /** Pan, zoom and rotate (default true). Small preview maps pass false. */
  interactive?: boolean
  /** Waze-style follow mode. */
  live?: boolean
  /** Live mode reports each position fix. */
  onPosition?: (p: MapPoint & { accuracy: number }) => void
  fog?: MapFog | null
  onMapClick?: (p: MapPoint) => void
  /** Accessible name for the map. */
  label?: string
  /** Extra space at the bottom (px) for cards over the map; keeps controls and fits clear. */
  bottomInset?: number
  /** The detailed street style (Discover, Explore). */
  detailed?: boolean
  /** Pin the theme instead of following the app's. */
  theme?: 'light' | 'dark'
  /** Dashed zone circles. */
  circles?: MapCircle[]
  /** Pin names show from this zoom on (otherwise on tap/selection only). */
  labelsFromZoom?: number
}

// The bits of GeoJSON the route and circle layers use.
interface Feature { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: 'LineString'; coordinates: Array<[number, number]> } | { type: 'Polygon'; coordinates: Array<Array<[number, number]>> } }
interface FeatureCollection { type: 'FeatureCollection'; features: Feature[] }

/** A circle as a 64-point polygon (Mapbox has no metre-sized circles). */
function circlePolygon(c: MapCircle): Feature {
  const ring: Array<[number, number]> = []
  const dLat = c.radiusM / 110540
  const dLng = c.radiusM / (111320 * Math.cos((c.lat * Math.PI) / 180))
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2
    ring.push([c.lng + dLng * Math.sin(a), c.lat + dLat * Math.cos(a)])
  }
  return { type: 'Feature', properties: { color: c.color ?? '#FFB800' }, geometry: { type: 'Polygon', coordinates: [ring] } }
}

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''
const ETA_RED = '#B82010'
const STYLES = { light: 'mapbox://styles/mapbox/light-v11', dark: 'mapbox://styles/mapbox/dark-v11' } as const
const DETAILED_STYLE = 'mapbox://styles/mapbox/standard'
const ETA_COLORS = {
  light: { water: '#A9DCE3', land: '#F5EFE5', park: '#D6E9C6', fog: 'rgba(238, 233, 224, 0.88)', casing: '#FFFFFF' },
  dark: { water: '#0B2A3A', land: '#101218', park: '#14251C', fog: 'rgba(12, 14, 22, 0.86)', casing: '#0A0B10' }
} as const
const COMPASS_KEY = 'eta_compass'

type Theme = keyof typeof STYLES

function useAppTheme(): Theme {
  const read = () => (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  const [theme, setTheme] = useState<Theme>('light')
  useEffect(() => {
    setTheme(read())
    const obs = new MutationObserver(() => setTheme(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return theme
}

// Road geometry, shared across every map on the page.
const routeCache = new Map<string, Promise<Array<[number, number]>>>()
function roadShape(points: MapPoint[], mode: RoadMode): Promise<Array<[number, number]>> {
  const q = points.map(p => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';')
  const key = `${mode}|${q}`
  let hit = routeCache.get(key)
  if (!hit) {
    hit = fetch(`/api/route?mode=${mode}&points=${q}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => (Array.isArray(d?.coordinates) && d.coordinates.length > 1 ? d.coordinates : points.map(p => [p.lng, p.lat])))
      .catch(() => points.map(p => [p.lng, p.lat] as [number, number]))
    routeCache.set(key, hit)
  }
  return hit
}

function pinElement(): HTMLDivElement {
  const el = document.createElement('div')
  el.className = 'eta-pin'
  el.innerHTML = '<span class="eta-pin-dot"></span><span class="eta-pin-label"></span>'
  return el
}

function stylePin(el: HTMLElement, m: MapMarker) {
  const size = m.size ?? 18
  el.style.setProperty('--pin-color', m.color ?? ETA_RED)
  el.style.setProperty('--pin-ring', m.ring ?? '#FFFFFF')
  el.style.setProperty('--pin-size', `${m.selected ? size + 8 : size}px`)
  el.classList.toggle('eta-pin-selected', Boolean(m.selected))
  el.classList.toggle('eta-pin-dim', Boolean(m.dim))
  el.classList.toggle('eta-pin-dashed', Boolean(m.dashed))
  el.classList.toggle('eta-pin-always', Boolean(m.labelAlways))
  el.classList.toggle('eta-pin-tappable', Boolean(m.onClick))
  ;(el.firstChild as HTMLElement).textContent = m.text ?? ''
  ;(el.lastChild as HTMLElement).textContent = m.label ?? ''
  el.setAttribute('aria-label', m.label ?? '')
  if (m.onClick) { el.setAttribute('role', 'button'); el.tabIndex = 0 } else { el.removeAttribute('role'); el.tabIndex = -1 }
}

/** Shortest turn between two compass bearings. */
function turn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

/** Draws the fog: a veil over the bounds with soft holes where you've been. */
function drawFog(canvas: HTMLCanvasElement, fog: MapFog, color: string) {
  const { west, south, east, north } = fog.bounds
  const midLat = (south + north) / 2
  const widthM = (east - west) * 111320 * Math.cos((midLat * Math.PI) / 180)
  const heightM = (north - south) * 110540
  const W = 1024
  const H = Math.max(256, Math.min(2048, Math.round((W * heightM) / widthM)))
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = color
  ctx.fillRect(0, 0, W, H)
  ctx.globalCompositeOperation = 'destination-out'
  const rPx = ((fog.radiusM ?? 400) / widthM) * W
  for (const p of fog.explored) {
    if (p.lng < west || p.lng > east || p.lat < south || p.lat > north) continue
    const x = ((p.lng - west) / (east - west)) * W
    const y = ((north - p.lat) / (north - south)) * H
    const g = ctx.createRadialGradient(x, y, rPx * 0.35, x, y, rPx)
    g.addColorStop(0, 'rgba(0,0,0,1)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, rPx, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** Standard style config for the ETA look in day or night. Unknown keys are ignored by older styles. */
function standardConfig(theme: Theme) {
  const c = ETA_COLORS[theme]
  return {
    lightPreset: theme === 'dark' ? 'night' : 'day',
    showPointOfInterestLabels: true,
    showPlaceLabels: true,
    showRoadLabels: true,
    showTransitLabels: true,
    show3dObjects: true,
    colorWater: c.water,
    colorGreenspace: c.park
  } as Record<string, string | boolean>
}

export default function EtaMap({ markers = [], routes = [], user = null, center, zoom = 13, fitTo, interactive = true, live = false, onPosition, fog = null, onMapClick, label, bottomInset = 0, detailed = false, theme: pinnedTheme, circles = [], labelsFromZoom }: Props) {
  const { t } = useLang()
  const appTheme = useAppTheme()
  const theme: Theme = pinnedTheme ?? appTheme
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const libRef = useRef<typeof import('mapbox-gl').default | null>(null)
  const pinsRef = useRef(new Map<string, { marker: MapboxMarker; data: MapMarker }>())
  const userMarkerRef = useRef<MapboxMarker | null>(null)
  const puckRef = useRef<MapboxMarker | null>(null)
  const fogCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const routeDataRef = useRef<FeatureCollection>({ type: 'FeatureCollection', features: [] })
  const circleDataRef = useRef<FeatureCollection>({ type: 'FeatureCollection', features: [] })
  const fittedRef = useRef<string | null>(null)
  const clickRef = useRef(onMapClick)
  const positionCbRef = useRef(onPosition)
  const [ready, setReady] = useState(false)
  const [styleTick, setStyleTick] = useState(0)

  // Live state lives in refs so the animation loop never re-renders React.
  const targetRef = useRef<MapPoint | null>(null)
  const shownRef = useRef<MapPoint | null>(null)
  const headingRef = useRef<number | null>(null)
  const shownHeadingRef = useRef(0)
  const followRef = useRef(false)
  const hasFixRef = useRef(false)
  const headingUpRef = useRef(true)
  const [follow, setFollow] = useState(false)
  const [headingUp, setHeadingUp] = useState(true)
  const [hasFix, setHasFix] = useState(false)
  const [bearing, setBearing] = useState(0)
  const [compassAsk, setCompassAsk] = useState(false)
  const [locError, setLocError] = useState(false)

  useEffect(() => { clickRef.current = onMapClick }, [onMapClick])
  useEffect(() => { positionCbRef.current = onPosition }, [onPosition])
  useEffect(() => { followRef.current = follow }, [follow])
  useEffect(() => { headingUpRef.current = headingUp }, [headingUp])

  const colors = ETA_COLORS[theme]

  // ---- Our layers, (re)installed on every style load -------------------
  const install = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const c = ETA_COLORS[theme]
    const paint = (id: string, prop: string, value: unknown) => { if (map.getLayer(id)) { try { map.setPaintProperty(id, prop as never, value as never) } catch {} } }
    paint('water', 'fill-color', c.water)
    paint('land', 'background-color', c.land)
    paint('background', 'background-color', c.land)
    paint('landuse', 'fill-color', c.park)
    paint('national-park', 'fill-color', c.park)

    if (detailed) {
      const cfg = standardConfig(theme)
      for (const [k, v] of Object.entries(cfg)) { try { map.setConfigProperty('basemap', k, v) } catch {} }
    }

    if (live && !detailed && !map.getLayer('eta-3d-buildings') && map.getSource('composite')) {
      map.addLayer({
        id: 'eta-3d-buildings', source: 'composite', 'source-layer': 'building', type: 'fill-extrusion', minzoom: 15,
        filter: ['==', 'extrude', 'true'],
        paint: { 'fill-extrusion-color': theme === 'dark' ? '#23262F' : '#E4DED3', 'fill-extrusion-height': ['get', 'height'], 'fill-extrusion-base': ['get', 'min_height'], 'fill-extrusion-opacity': 0.7 }
      })
    }

    if (!map.getSource('eta-routes')) {
      map.addSource('eta-routes', { type: 'geojson', data: routeDataRef.current as never })
      map.addLayer({ id: 'eta-routes-casing', type: 'line', source: 'eta-routes', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': c.casing, 'line-width': ['+', ['get', 'width'], 3], 'line-opacity': 0.9 } })
      map.addLayer({ id: 'eta-routes-line', type: 'line', source: 'eta-routes', filter: ['!=', ['get', 'dashed'], true], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'] } })
      map.addLayer({ id: 'eta-routes-dash', type: 'line', source: 'eta-routes', filter: ['==', ['get', 'dashed'], true], layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'width'], 'line-dasharray': [1, 1.6] } })
    }
    if (!map.getSource('eta-circles')) {
      map.addSource('eta-circles', { type: 'geojson', data: circleDataRef.current as never })
      map.addLayer({ id: 'eta-circles-fill', type: 'fill', source: 'eta-circles', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.12 } })
      map.addLayer({ id: 'eta-circles-line', type: 'line', source: 'eta-circles', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.9 } })
    }
    setStyleTick(n => n + 1)
  }, [theme, live, detailed])

  // ---- Create the map once ----------------------------------------------
  useEffect(() => {
    if (!TOKEN) return
    let cancelled = false
    let resize: ResizeObserver | null = null
    ;(async () => {
      const mapboxgl = (await import('mapbox-gl')).default
      if (cancelled || !containerRef.current) return
      mapboxgl.accessToken = TOKEN
      libRef.current = mapboxgl
      const start = center ?? fitTo?.[0] ?? markers[0] ?? user ?? { lat: 18.27, lng: -78.35 }
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: detailed ? DETAILED_STYLE : STYLES[theme],
        ...(detailed ? { config: { basemap: standardConfig(theme) } } : {}),
        center: [start.lng, start.lat],
        zoom,
        pitch: live ? 55 : 0,
        interactive,
        attributionControl: false,
        dragRotate: interactive,
        pitchWithRotate: live,
        cooperativeGestures: false
      })
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left')
      mapRef.current = map
      map.on('style.load', install)
      map.on('load', () => setReady(true))
      map.on('click', e => clickRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }))
      map.on('rotate', () => setBearing(map.getBearing()))
      // Names on the pins once you're close enough to read them.
      if (labelsFromZoom !== undefined) {
        const near = () => containerRef.current?.classList.toggle('eta-map-near', map.getZoom() >= labelsFromZoom)
        map.on('zoom', near)
        near()
      }
      // Moving the map by hand stops following, like Waze; zooming doesn't.
      const stop = (e: { originalEvent?: unknown }) => { if (e.originalEvent) setFollow(false) }
      map.on('dragstart', stop)
      map.on('rotatestart', e => { if (e.originalEvent) { setFollow(false) } })
      resize = new ResizeObserver(() => map.resize())
      resize.observe(containerRef.current)
    })()
    return () => {
      cancelled = true
      resize?.disconnect()
      pinsRef.current.forEach(p => p.marker.remove())
      pinsRef.current.clear()
      mapRef.current?.remove()
      mapRef.current = null
      setReady(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Theme follows the app ---------------------------------------------
  const themeRef = useRef(theme)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || themeRef.current === theme) return
    themeRef.current = theme
    map.off('style.load', install)
    map.on('style.load', install)
    // The detailed style just switches day/night; the others swap style.
    if (detailed) install()
    else map.setStyle(STYLES[theme])
  }, [theme, ready, install, detailed])

  // ---- Zone circles --------------------------------------------------------
  const circleKey = JSON.stringify(circles.map(c => [c.id, c.lat.toFixed(5), c.lng.toFixed(5), c.radiusM, c.color]))
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    circleDataRef.current = { type: 'FeatureCollection', features: circles.map(circlePolygon) }
    ;(map.getSource('eta-circles') as GeoJSONSource | undefined)?.setData(circleDataRef.current as never)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleKey, ready, styleTick])

  // ---- Markers -----------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = libRef.current
    if (!map || !mapboxgl || !ready) return
    const seen = new Set<string>()
    for (const m of markers) {
      seen.add(m.id)
      const existing = pinsRef.current.get(m.id)
      if (existing) {
        existing.data = m
        existing.marker.setLngLat([m.lng, m.lat])
        stylePin(existing.marker.getElement(), m)
        continue
      }
      const el = pinElement()
      stylePin(el, m)
      const entry = { marker: new mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([m.lng, m.lat]).addTo(map), data: m }
      const fire = (e: Event) => { e.stopPropagation(); entry.data.onClick?.() }
      el.addEventListener('click', fire)
      el.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter') fire(e) })
      pinsRef.current.set(m.id, entry)
    }
    pinsRef.current.forEach((p, id) => { if (!seen.has(id)) { p.marker.remove(); pinsRef.current.delete(id) } })
  }, [markers, ready])

  // ---- Static user dot ---------------------------------------------------
  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = libRef.current
    if (!map || !mapboxgl || !ready || live) return
    if (!user) { userMarkerRef.current?.remove(); userMarkerRef.current = null; return }
    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'eta-user'
      el.setAttribute('aria-label', t('m.map.you'))
      userMarkerRef.current = new mapboxgl.Marker({ element: el }).setLngLat([user.lng, user.lat]).addTo(map)
    } else userMarkerRef.current.setLngLat([user.lng, user.lat])
  }, [user, ready, live, t])

  // ---- Routes along real roads -------------------------------------------
  const routeKey = useMemo(() => JSON.stringify(routes.map(r => [r.id, r.mode, r.color, r.width, r.dashed, r.points.map(p => [p.lat.toFixed(5), p.lng.toFixed(5)])])), [routes])
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    let cancelled = false
    const feature = (r: MapRoute, coords: Array<[number, number]>): Feature => ({ type: 'Feature', properties: { color: r.color ?? ETA_RED, width: r.width ?? 4, dashed: Boolean(r.dashed) }, geometry: { type: 'LineString', coordinates: coords } })
    const usable = routes.filter(r => r.points.length > 1)
    const push = (features: Feature[]) => {
      routeDataRef.current = { type: 'FeatureCollection', features }
      ;(map.getSource('eta-routes') as GeoJSONSource | undefined)?.setData(routeDataRef.current as never)
    }
    // Straight first, so something shows at once; roads replace it.
    push(usable.map(r => feature(r, r.points.map(p => [p.lng, p.lat]))))
    Promise.all(usable.map(r => roadShape(r.points, r.mode ?? 'driving').then(c => feature(r, c)))).then(f => { if (!cancelled) push(f) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, ready, styleTick])

  // ---- Fog of war ----------------------------------------------------------
  const fogKey = fog ? JSON.stringify([fog.bounds, fog.radiusM, fog.explored.length, fog.explored.slice(-1)[0]]) : ''
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    if (!fog) { if (map.getLayer('eta-fog')) map.removeLayer('eta-fog'); if (map.getSource('eta-fog')) map.removeSource('eta-fog'); return }
    const canvas = fogCanvasRef.current ?? (fogCanvasRef.current = document.createElement('canvas'))
    drawFog(canvas, fog, colors.fog)
    const { west, south, east, north } = fog.bounds
    const coordinates: [[number, number], [number, number], [number, number], [number, number]] = [[west, north], [east, north], [east, south], [west, south]]
    const src = map.getSource('eta-fog') as CanvasSource | undefined
    if (!src) {
      map.addSource('eta-fog', { type: 'canvas', canvas, coordinates, animate: false })
      map.addLayer({ id: 'eta-fog', type: 'raster', source: 'eta-fog', paint: { 'raster-fade-duration': 0, 'raster-opacity': 1 } }, map.getLayer('eta-routes-casing') ? 'eta-routes-casing' : undefined)
    } else {
      src.setCoordinates(coordinates)
      // A static canvas source re-reads its pixels while playing.
      src.play()
      requestAnimationFrame(() => src.pause())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fogKey, ready, styleTick, colors.fog])

  // ---- Keep things in view -------------------------------------------------
  const fitPoints = useMemo(() => fitTo ?? [...markers, ...routes.flatMap(r => r.points), ...(user && !live ? [user] : [])], [fitTo, markers, routes, user, live])
  const fitKey = fitPoints.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  useEffect(() => {
    const map = mapRef.current
    const mapboxgl = libRef.current
    if (!map || !mapboxgl || !ready || !fitPoints.length || followRef.current) return
    if (fittedRef.current === fitKey) return
    const first = fittedRef.current === null
    fittedRef.current = fitKey
    const pad = { top: 48, left: 40, right: 40, bottom: 48 + bottomInset }
    if (fitPoints.length === 1) map.easeTo({ center: [fitPoints[0].lng, fitPoints[0].lat], zoom: Math.max(zoom, 15), duration: first ? 0 : 600, padding: pad })
    else {
      const b = new mapboxgl.LngLatBounds()
      fitPoints.forEach(p => b.extend([p.lng, p.lat]))
      map.fitBounds(b, { padding: pad, maxZoom: 16, duration: first ? 0 : 600 })
    }
  }, [fitKey, ready, fitPoints, zoom, bottomInset])

  // ---- Live: position, heading, follow -----------------------------------
  const onOrientation = useCallback((e: DeviceOrientationEvent) => {
    const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
    const h = typeof ios === 'number' ? ios : e.absolute && e.alpha !== null ? 360 - e.alpha : null
    if (h !== null && Number.isFinite(h)) headingRef.current = h
  }, [])

  const listenCompass = useCallback(() => {
    window.addEventListener('deviceorientationabsolute', onOrientation as EventListener)
    window.addEventListener('deviceorientation', onOrientation)
  }, [onOrientation])

  const askCompass = useCallback(async () => {
    setCompassAsk(false)
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
    try {
      const result = await DOE.requestPermission?.()
      try { localStorage.setItem(COMPASS_KEY, result ?? 'granted') } catch {}
      if (result === 'granted') listenCompass()
    } catch {
      try { localStorage.setItem(COMPASS_KEY, 'denied') } catch {}
    }
  }, [listenCompass])

  useEffect(() => {
    if (!live) return
    // iPhone asks for the compass separately, and only from a tap: explain once.
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
    if (typeof DOE?.requestPermission === 'function') {
      let asked: string | null = null
      try { asked = localStorage.getItem(COMPASS_KEY) } catch {}
      if (!asked) setCompassAsk(true)
      else if (asked === 'granted') listenCompass()
    } else listenCompass()

    if (!navigator.geolocation) { setLocError(true); return }
    const id = navigator.geolocation.watchPosition(
      p => {
        const fix = { lat: p.coords.latitude, lng: p.coords.longitude }
        targetRef.current = fix
        if (!shownRef.current) shownRef.current = fix
        // No compass: use the GPS course while moving.
        if (p.coords.heading !== null && Number.isFinite(p.coords.heading) && (p.coords.speed ?? 0) > 1) headingRef.current = p.coords.heading
        setLocError(false)
        if (!hasFixRef.current) { hasFixRef.current = true; setHasFix(true); setFollow(true) }
        positionCbRef.current?.({ ...fix, accuracy: p.coords.accuracy })
      },
      err => setLocError(err.code === 1),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    )
    return () => {
      navigator.geolocation.clearWatch(id)
      window.removeEventListener('deviceorientationabsolute', onOrientation as EventListener)
      window.removeEventListener('deviceorientation', onOrientation)
    }
  }, [live, listenCompass, onOrientation])

  // The animation loop: glide the arrow toward the latest fix and turn it
  // toward the heading; while following, the camera rides along.
  useEffect(() => {
    if (!live || !ready) return
    const map = mapRef.current
    const mapboxgl = libRef.current
    if (!map || !mapboxgl) return
    let raf = 0
    let last = performance.now()
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const target = targetRef.current
      if (target) {
        const shown = shownRef.current ?? target
        const k = reduce ? 1 : 1 - Math.exp(-dt * 4)
        const next = { lat: shown.lat + (target.lat - shown.lat) * k, lng: shown.lng + (target.lng - shown.lng) * k }
        shownRef.current = next
        if (headingRef.current !== null) shownHeadingRef.current = (shownHeadingRef.current + turn(shownHeadingRef.current, headingRef.current) * (reduce ? 1 : 1 - Math.exp(-dt * 6)) + 360) % 360
        if (!puckRef.current) {
          const el = document.createElement('div')
          el.className = 'eta-puck'
          el.setAttribute('aria-label', t('m.map.you'))
          el.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="18" fill="rgba(10,132,255,0.18)"/><path d="M20 6 L30 31 L20 25 L10 31 Z" fill="#0A84FF" stroke="#FFFFFF" stroke-width="2.5" stroke-linejoin="round"/></svg>'
          puckRef.current = new mapboxgl.Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([next.lng, next.lat]).addTo(map)
        }
        puckRef.current.setLngLat([next.lng, next.lat]).setRotation(shownHeadingRef.current)
        if (followRef.current) {
          map.jumpTo({ center: [next.lng, next.lat], bearing: headingUpRef.current && headingRef.current !== null ? shownHeadingRef.current : headingUpRef.current ? map.getBearing() : 0, padding: { top: 0, left: 0, right: 0, bottom: bottomInset * 0.6 } })
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [live, ready, bottomInset, t])

  const recenter = () => {
    const map = mapRef.current
    if (!map) return
    setFollow(true)
    map.easeTo({ zoom: Math.max(map.getZoom(), 16), pitch: 55, duration: 500 })
  }
  const toggleHeading = () => {
    const map = mapRef.current
    const next = !headingUp
    setHeadingUp(next)
    if (!next) map?.easeTo({ bearing: 0, duration: 400 })
    // Turning heading-up back on is a tap, so iPhone can still be asked for the compass.
    const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
    let granted: string | null = null
    try { granted = localStorage.getItem(COMPASS_KEY) } catch {}
    if (next && typeof DOE?.requestPermission === 'function' && granted !== 'granted') askCompass()
    if (!follow) recenter()
  }

  if (!TOKEN) {
    return (
      <div role="img" aria-label={label} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--system-bg-secondary)', color: 'var(--label-secondary)', fontSize: '13px', padding: '16px', textAlign: 'center' }}>
        {t('m.map.unavailable')}
      </div>
    )
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} role="region" aria-label={label} style={{ position: 'absolute', inset: 0, background: colors.land }} />
      {live && (
        <div className="eta-map-controls" style={{ bottom: `calc(${bottomInset + 16}px + env(safe-area-inset-bottom, 0px))` }}>
          <button onClick={toggleHeading} aria-pressed={headingUp} aria-label={headingUp ? t('m.map.northUp') : t('m.map.headingUp')} title={headingUp ? t('m.map.northUp') : t('m.map.headingUp')} className="eta-map-btn">
            <span style={{ display: 'inline-flex', transform: `rotate(${-bearing}deg)`, transition: 'transform 0.2s linear' }}>
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M12 2 L16 12 L12 10.5 L8 12 Z" fill="#E5342A" /><path d="M12 22 L8 12 L12 13.5 L16 12 Z" fill="currentColor" opacity="0.5" /></svg>
            </span>
            <span className="eta-map-btn-tag">{headingUp ? t('m.map.headingShort') : 'N'}</span>
          </button>
          {hasFix && !follow && (
            <button onClick={recenter} aria-label={t('m.map.recenter')} title={t('m.map.recenter')} className="eta-map-btn eta-map-btn-primary">
              <Icon name="navigate" size={20} />
            </button>
          )}
        </div>
      )}
      {live && locError && <p role="status" className="eta-map-toast">{t('m.map.noLocation')}</p>}
      {compassAsk && (
        <div className="eta-map-compass" role="dialog" aria-label={t('m.map.compassTitle')}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{t('m.map.compassTitle')}</p>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)', margin: '2px 0 10px' }}>{t('m.map.compassBody')}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-tertiary" onClick={() => { setCompassAsk(false); try { localStorage.setItem(COMPASS_KEY, 'later') } catch {} }} style={{ flex: 1, minHeight: '40px' }}>{t('m.onb.notNow')}</button>
            <button className="btn btn-primary" onClick={askCompass} style={{ flex: 1, minHeight: '40px' }}>{t('m.map.compassOn')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
