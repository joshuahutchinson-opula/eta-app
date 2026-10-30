// components/TripMap.tsx — the active trip's stops and the traveler's live
// position on a real map. Done stops are dimmed, the next one is gold.
'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false })
const Polyline = dynamic(() => import('react-leaflet').then(m => m.Polyline), { ssr: false })
const Tooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip), { ssr: false })

// Fits the view to every point once the map exists, then again when they change.
const FitBounds = dynamic(
  () => import('react-leaflet').then(mod => {
    function Component({ points }: { points: Array<[number, number]> }) {
      const map = mod.useMap()
      const key = points.map(p => p.join(',')).join('|')
      useEffect(() => {
        const t = setTimeout(() => {
          map.invalidateSize()
          if (points.length === 1) map.setView(points[0], 15)
          else if (points.length > 1) map.fitBounds(points, { padding: [40, 40], maxZoom: 16 })
        }, 150)
        return () => clearTimeout(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [map, key])
      return null
    }
    return Component
  }),
  { ssr: false }
)

export interface TripMapStop {
  name: string
  lat: number | null
  lng: number | null
}

export default function TripMap({ stops, currentIndex, user, fallbackCenter }: {
  stops: TripMapStop[]
  currentIndex: number
  user: { lat: number; lng: number } | null
  fallbackCenter: [number, number]
}) {
  const placed = stops.map((s, i) => ({ ...s, i })).filter((s): s is TripMapStop & { i: number; lat: number; lng: number } => s.lat !== null && s.lng !== null)
  const points: Array<[number, number]> = [...placed.map(s => [s.lat, s.lng] as [number, number]), ...(user ? [[user.lat, user.lng] as [number, number]] : [])]

  return (
    <MapContainer center={points[0] ?? fallbackCenter} zoom={14} zoomControl={false} style={{ position: 'absolute', inset: 0, background: '#0A1628' }}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CARTO" />
      <FitBounds points={points} />
      {placed.length > 1 && (
        <Polyline positions={placed.map(s => [s.lat, s.lng] as [number, number])} pathOptions={{ color: '#00E5CC', weight: 3, dashArray: '6 6', opacity: 0.8 }} />
      )}
      {placed.map(s => (
        <CircleMarker
          key={`${s.i}-${s.name}`}
          center={[s.lat, s.lng]}
          radius={s.i === currentIndex ? 11 : 8}
          pathOptions={{
            color: '#FFFFFF',
            weight: 2,
            fillColor: s.i < currentIndex ? '#636366' : s.i === currentIndex ? '#FFB800' : '#B82010',
            fillOpacity: 0.95
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent={s.i === currentIndex}>{`${s.i + 1}. ${s.name}`}</Tooltip>
        </CircleMarker>
      ))}
      {user && (
        <CircleMarker center={[user.lat, user.lng]} radius={8} pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: '#007AFF', fillOpacity: 1 }}>
          <Tooltip direction="top" offset={[0, -8]}>You</Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
