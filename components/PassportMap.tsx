// components/PassportMap.tsx — every place in your passport as a pin:
// vendors red, photo spots gold, hidden gems purple.
'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false })
const Tooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip), { ssr: false })

const FitBounds = dynamic(
  () => import('react-leaflet').then(mod => {
    function Component({ points }: { points: Array<[number, number]> }) {
      const map = mod.useMap()
      const key = points.map(p => p.join(',')).join('|')
      useEffect(() => {
        const t = setTimeout(() => {
          map.invalidateSize()
          if (points.length === 1) map.setView(points[0], 14)
          else if (points.length > 1) map.fitBounds(points, { padding: [30, 30], maxZoom: 15 })
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

const COLOR = { vendor: '#B82010', photospot: '#FFB800', gem: '#AF52DE' } as const

export default function PassportMap({ places, center }: { places: Array<{ kind: 'vendor' | 'photospot' | 'gem'; id: string; name: string; lat: number; lng: number }>; center: [number, number] }) {
  const points = places.map(p => [p.lat, p.lng] as [number, number])
  return (
    <MapContainer center={points[0] ?? center} zoom={12} zoomControl={false} style={{ position: 'absolute', inset: 0, background: '#0A1628' }}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CARTO" />
      <FitBounds points={points} />
      {places.map(p => (
        <CircleMarker key={`${p.kind}-${p.id}`} center={[p.lat, p.lng]} radius={7} pathOptions={{ color: '#FFFFFF', weight: 2, fillColor: COLOR[p.kind], fillOpacity: 0.95 }}>
          <Tooltip direction="top" offset={[0, -6]}>{p.name}</Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
