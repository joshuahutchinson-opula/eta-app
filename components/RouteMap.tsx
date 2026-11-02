// components/RouteMap.tsx — a small, still map of a route: numbered stop pins
// joined by a dashed line. Used on the Results cards and in experience detail.
// Leaflet touches `window`, so load it with next/dynamic and ssr: false.
'use client'

import { useEffect, useMemo } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'

export interface RouteMapStop {
  name: string
  lat: number | null | undefined
  lng: number | null | undefined
}

function FitRoute({ points }: { points: Array<[number, number]> }) {
  const map = useMap()
  const key = points.map(p => p.join(',')).join('|')
  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize()
      if (points.length === 1) map.setView(points[0], 15)
      else if (points.length > 1) map.fitBounds(points, { padding: [28, 28], maxZoom: 16 })
    }, 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

const pin = (n: number) => L.divIcon({
  className: 'route-map-pin',
  html: `<span>${n}</span>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13]
})

export default function RouteMap({ stops, fallbackCenter, interactive = false, label }: {
  stops: RouteMapStop[]
  fallbackCenter: [number, number]
  /** Pan and zoom (detail screen); the Results cards stay still so swiping works. */
  interactive?: boolean
  /** Accessible name, e.g. "Route map: 4 stops". */
  label: string
}) {
  const placed = useMemo(
    () => stops.map((s, i) => ({ ...s, n: i + 1 })).filter((s): s is RouteMapStop & { n: number; lat: number; lng: number } => typeof s.lat === 'number' && typeof s.lng === 'number'),
    [stops]
  )
  const points = placed.map(s => [s.lat, s.lng] as [number, number])

  return (
    <div role="img" aria-label={label} style={{ position: 'absolute', inset: 0 }}>
      <MapContainer
        center={points[0] ?? fallbackCenter}
        zoom={14}
        zoomControl={false}
        attributionControl={false}
        dragging={interactive}
        touchZoom={interactive}
        scrollWheelZoom={false}
        doubleClickZoom={interactive}
        boxZoom={false}
        keyboard={false}
        style={{ position: 'absolute', inset: 0, background: '#0A1628' }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <FitRoute points={points} />
        {points.length > 1 && <Polyline positions={points} pathOptions={{ color: '#FFFFFF', weight: 2.5, dashArray: '6 7', opacity: 0.85 }} />}
        {placed.map(s => <Marker key={`${s.n}-${s.name}`} position={[s.lat, s.lng]} icon={pin(s.n)} interactive={false} keyboard={false} />)}
      </MapContainer>
    </div>
  )
}
