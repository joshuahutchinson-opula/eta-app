// components/RouteMap.tsx — a route: numbered stop pins joined along real
// roads (components/map/EtaMap → /api/route). Used on the Results cards
// (still, so swiping the carousel works) and in experience detail.
'use client'

import { useMemo } from 'react'
import EtaMap from '@/components/map/EtaMap'

export interface RouteMapStop {
  name: string
  lat: number | null | undefined
  lng: number | null | undefined
}

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
  const markers = useMemo(() => placed.map(s => ({ id: `${s.n}-${s.name}`, lat: s.lat, lng: s.lng, text: String(s.n), size: 24, label: s.name })), [placed])
  const routes = useMemo(() => (placed.length > 1 ? [{ id: 'route', points: placed.map(s => ({ lat: s.lat, lng: s.lng })), mode: 'walking' as const }] : []), [placed])

  return (
    <EtaMap
      center={{ lat: fallbackCenter[0], lng: fallbackCenter[1] }}
      zoom={14}
      interactive={interactive}
      markers={markers}
      routes={routes}
      label={label}
    />
  )
}
