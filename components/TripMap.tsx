// components/TripMap.tsx — the active trip's stops joined along real roads,
// the traveler's position and (opt-in) the rest of the crew's. Done stops
// are dimmed, the next one is gold, crew members are green. With `live` it
// becomes the Waze-style map that follows you (components/map/EtaMap).
'use client'

import { useMemo } from 'react'
import EtaMap from '@/components/map/EtaMap'

export interface TripMapStop {
  name: string
  lat: number | null
  lng: number | null
}

export default function TripMap({ stops, currentIndex, user, fallbackCenter, crew = [], youLabel = 'You', live = false, bottomInset = 0 }: {
  stops: TripMapStop[]
  currentIndex: number
  user: { lat: number; lng: number } | null
  fallbackCenter: [number, number]
  /** Crew members sharing their live location (never includes the viewer). */
  crew?: Array<{ name: string; lat: number; lng: number }>
  youLabel?: string
  /** Follow the traveler, heading-up, as on the active trip screen. */
  live?: boolean
  /** Space kept clear at the bottom for the cards over the map. */
  bottomInset?: number
}) {
  const placed = useMemo(() => stops.map((s, i) => ({ ...s, i })).filter((s): s is TripMapStop & { i: number; lat: number; lng: number } => s.lat !== null && s.lng !== null), [stops])
  const markers = useMemo(() => [
    ...placed.map(s => ({
      id: `stop-${s.i}`,
      lat: s.lat,
      lng: s.lng,
      text: String(s.i + 1),
      size: s.i === currentIndex ? 28 : 22,
      color: s.i < currentIndex ? '#636366' : s.i === currentIndex ? '#FFB800' : '#B82010',
      dim: s.i < currentIndex,
      label: `${s.i + 1}. ${s.name}`,
      labelAlways: s.i === currentIndex,
      selected: s.i === currentIndex
    })),
    ...crew.map(c => ({ id: `crew-${c.name}`, lat: c.lat, lng: c.lng, color: '#34C759', size: 18, label: c.name, labelAlways: true }))
  ], [placed, currentIndex, crew])
  const routes = useMemo(() => {
    const ahead = placed.filter(s => s.i >= Math.max(0, currentIndex - 1))
    const done = placed.filter(s => s.i <= currentIndex)
    return [
      ...(done.length > 1 ? [{ id: 'done', points: done.map(s => ({ lat: s.lat, lng: s.lng })), color: '#8E8E93', width: 3, dashed: true, mode: 'walking' as const }] : []),
      ...(ahead.length > 1 ? [{ id: 'ahead', points: ahead.map(s => ({ lat: s.lat, lng: s.lng })), color: '#00B8A9', width: 5, mode: 'walking' as const }] : [])
    ]
  }, [placed, currentIndex])

  return (
    <EtaMap
      center={{ lat: fallbackCenter[0], lng: fallbackCenter[1] }}
      zoom={14}
      markers={markers}
      routes={routes}
      user={live ? null : user}
      live={live}
      bottomInset={bottomInset}
      label={`${youLabel}: ${placed.map(s => s.name).join(', ')}`}
    />
  )
}
