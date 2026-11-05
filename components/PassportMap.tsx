// components/PassportMap.tsx — every place in your passport as a pin:
// vendors red, photo spots gold, hidden gems purple (components/map/EtaMap).
'use client'

import EtaMap from '@/components/map/EtaMap'

const COLOR = { vendor: '#B82010', photospot: '#FFB800', gem: '#AF52DE' } as const

export default function PassportMap({ places, center }: { places: Array<{ kind: 'vendor' | 'photospot' | 'gem'; id: string; name: string; lat: number; lng: number }>; center: [number, number] }) {
  return (
    <EtaMap
      center={{ lat: center[0], lng: center[1] }}
      markers={places.map(p => ({ id: `${p.kind}-${p.id}`, lat: p.lat, lng: p.lng, color: COLOR[p.kind], label: p.name, size: 16 }))}
      label={places.map(p => p.name).join(', ')}
    />
  )
}
