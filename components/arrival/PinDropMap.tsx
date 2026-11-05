// components/arrival/PinDropMap.tsx — "Not listed? Drop a pin": tap the map
// to place your stay. Loaded with next/dynamic (ssr: false) because Leaflet
// needs the browser.
'use client'

import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet'

function TapToPick({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: e => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

export default function PinDropMap({ center, pin, onPick }: { center: [number, number]; pin: { lat: number; lng: number } | null; onPick: (p: { lat: number; lng: number }) => void }) {
  return (
    <MapContainer center={center} zoom={13} zoomControl={false} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CARTO" />
      <TapToPick onPick={onPick} />
      {pin && <CircleMarker center={[pin.lat, pin.lng]} radius={10} pathOptions={{ color: '#FFFFFF', weight: 3, fillColor: '#B82010', fillOpacity: 1 }} />}
    </MapContainer>
  )
}
