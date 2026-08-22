// app/explore/page.tsx
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import FloatingPill from '@/components/FloatingPill'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
)

const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
)

const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
)

const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
)

const CircleMarker = dynamic(
  () => import('react-leaflet').then(mod => mod.CircleMarker),
  { ssr: false }
)

interface Vendor {
  id: string
  name: string
  category: string
  neighborhood: string
  lat: number
  lng: number
  isPremium: boolean
  isTransport: boolean
  visibleOnMap: boolean
}

interface PhotoSpot {
  id: string
  name: string
  description: string
  lat: number
  lng: number
}

export default function ExplorePage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [photoSpots, setPhotoSpots] = useState<PhotoSpot[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [vendorsRes, spotsRes] = await Promise.all([
        fetch('/api/vendors'),
        fetch('/api/photospots')
      ])

      const vendorsData = await vendorsRes.json()
      const spotsData = await spotsRes.json()

      setVendors(vendorsData.filter((v: Vendor) => v.visibleOnMap && !v.isTransport))
      setPhotoSpots(spotsData)
    } catch (error) {
      console.error(error)
    }
  }

  if (!mounted) {
    return (
      <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', background: '#0A1628' }}>
        <FloatingPill />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'rgba(245,239,230,0.6)' }}>Wull on deh...</p>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', background: '#0A1628' }}>
      <FloatingPill />

      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[18.27, -78.35]}
          zoom={14}
          style={{ height: '100%', width: '100%', position: 'absolute', inset: 0, background: '#0A1628' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          />

          {/* Vendor Markers */}
          {vendors.map(v => (
            <CircleMarker
              key={v.id}
              center={[v.lat, v.lng]}
              radius={v.isPremium ? 10 : 7}
              pathOptions={{
                color: v.isPremium ? '#FFB800' : '#F5EFE6',
                fillColor: v.isPremium ? '#FFB800' : '#F5EFE6',
                fillOpacity: 0.8,
                weight: 2
              }}
            >
              <Popup>
                <div style={{ background: '#0F0E0C', padding: '8px', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#F5EFE6' }}>
                    {v.name}
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(245,239,230,0.7)' }}>
                    {v.category} • {v.neighborhood}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* Photo Spot Markers */}
          {photoSpots.map(s => (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lng]}
              radius={6}
              pathOptions={{
                color: '#FF4B2B',
                fillColor: '#FF4B2B',
                fillOpacity: 0.6,
                weight: 2
              }}
            >
              <Popup>
                <div style={{ background: '#0F0E0C', padding: '8px', borderRadius: '8px' }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#F5EFE6' }}>
                    {s.name}
                  </p>
                  <p style={{ fontSize: '11px', color: 'rgba(245,239,230,0.7)' }}>
                    {s.description}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        {/* Shuffle Button */}
        <div style={{ position: 'absolute', bottom: '80px', right: '16px', zIndex: 1000 }}>
          <button
            className="glass-button"
            style={{ width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="shuffle" size={18} />
          </button>
        </div>
      </div>

      <Dock />
    </main>
  )
}