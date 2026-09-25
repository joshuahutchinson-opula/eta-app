// components/ExploreMap.tsx
'use client'

import { useEffect } from 'react'
import { categoryStyle, priceTier } from '@/lib/vendor-style'
import dynamic from 'next/dynamic'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

// Leaflet measures its container's size once at mount. If that happens
// before the surrounding flex/dvh layout has settled (common with a
// dynamically-imported map inside a flex:1 container), it caches a 0×0
// size and every marker's pixel position - and therefore its click
// hit-testing - stays wrong forever, even though tiles still render
// (they overflow their nominally-zero-height parent). Re-measuring once
// after mount fixes it.
const MapReadyFix = dynamic(
  () => import('react-leaflet').then(mod => {
    function Component() {
      const map = mod.useMap()
      useEffect(() => {
        const t1 = setTimeout(() => map.invalidateSize(), 100)
        const t2 = setTimeout(() => map.invalidateSize(), 400)
        return () => { clearTimeout(t1); clearTimeout(t2) }
      }, [map])
      return null
    }
    return Component
  }),
  { ssr: false }
)

export interface MapVendor {
  id: string
  name: string
  category: string
  neighborhood: string
  lat: number
  lng: number
  isPremium: boolean
  isTransport: boolean
  visibleOnMap: boolean
  images?: string[]
  priceRange?: string
  rating?: number | null
  reviewCount?: number | null
}

export interface MapPhotoSpot {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  officialPhoto?: string
}

interface ExploreMapProps {
  vendors: MapVendor[]
  photoSpots: MapPhotoSpot[]
  center?: [number, number]
  zoom?: number
  height?: string | number
  /** If provided, tapping a vendor pin calls this instead of showing the default popup. */
  onVendorTap?: (vendor: MapVendor) => void
  /** If provided, tapping a photo spot pin calls this instead of showing the default popup. */
  onPhotoSpotTap?: (spot: MapPhotoSpot) => void
}

export default function ExploreMap({
  vendors,
  photoSpots,
  center = [18.27, -78.35],
  zoom = 14,
  height = '100%',
  onVendorTap,
  onPhotoSpotTap
}: ExploreMapProps) {
  // The default "fill the parent" case uses inset:0 against the nearest
  // positioned ancestor instead of height:'100%' - percentage heights on a
  // plain block child of a flex:1 parent don't reliably resolve here (the
  // parent measures correctly, but the percentage doesn't propagate down),
  // which was silently collapsing the whole map - and every marker's click
  // hit-testing with it - to 0px tall.
  const fillParent = height === '100%'

  return (
    <div style={fillParent ? { position: 'absolute', inset: 0 } : { position: 'relative', height, width: '100%' }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', position: 'absolute', inset: 0, background: '#0A1628' }}
        zoomControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />
        <MapReadyFix />
        {vendors.map(v => (
          <CircleMarker
            key={v.id}
            center={[v.lat, v.lng]}
            radius={v.isPremium ? 10 : 7}
            pathOptions={{
              color: v.isPremium ? '#FFB800' : '#FFFFFF',
              fillColor: categoryStyle(v.category).color,
              fillOpacity: 0.8,
              weight: 2
            }}
            eventHandlers={onVendorTap ? { click: () => onVendorTap(v) } : undefined}
          >
            {!onVendorTap && (
              <Popup>
                <div style={{ background: '#1C1C1E', padding: '8px', borderRadius: '8px', color: '#FFFFFF' }}>
                  <p style={{ fontWeight: 600, fontSize: '15px' }}>{v.name}</p>
                  <p style={{ fontSize: '13px', color: categoryStyle(v.category).color, fontWeight: 600 }}>
                    {categoryStyle(v.category).label}{v.priceRange ? ` · ${'$'.repeat(priceTier(v.priceRange))}` : ''}
                    <span style={{ color: '#A1A1A1', fontWeight: 400 }}> · {v.neighborhood}</span>
                  </p>
                  <p style={{ fontSize: '13px', color: '#FFFFFF', marginTop: '2px' }}>
                    {v.rating ? <>★ {v.rating.toFixed(1)} <span style={{ color: '#A1A1A1' }}>({v.reviewCount ?? 0})</span></> : <span style={{ color: '#A1A1A1' }}>New on ETA</span>}
                  </p>
                  <a href={`/vendor/${v.id}`} style={{ display: 'inline-block', marginTop: '6px', fontSize: '13px', fontWeight: 700, color: '#F24230' }}>View →</a>
                </div>
              </Popup>
            )}
          </CircleMarker>
        ))}
        {photoSpots.map(s => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lng]}
            radius={6}
            pathOptions={{
              color: '#FFB800',
              fillColor: '#FFB800',
              fillOpacity: 0.6,
              weight: 2
            }}
            eventHandlers={onPhotoSpotTap ? { click: () => onPhotoSpotTap(s) } : undefined}
          >
            {!onPhotoSpotTap && (
              <Popup>
                <div style={{ background: '#1C1C1E', padding: '8px', borderRadius: '8px', color: '#FFFFFF' }}>
                  <p style={{ fontWeight: 600, fontSize: '15px' }}>{s.name}</p>
                  <p style={{ fontSize: '13px', color: '#A1A1A1' }}>{s.description}</p>
                </div>
              </Popup>
            )}
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}
