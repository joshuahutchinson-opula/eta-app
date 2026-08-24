// app/explore/page.tsx
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false })
const CircleMarker = dynamic(() => import('react-leaflet').then(mod => mod.CircleMarker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false })

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
      <main style={{ minHeight: '100dvh', background: '#000000', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.6)' }}>Wull on deh...</p>
        </div>
        <Dock />
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100dvh', background: '#000000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <MapContainer
          center={[18.27, -78.35]}
          zoom={14}
          style={{ height: '100%', width: '100%', position: 'absolute', inset: 0, background: '#0A1628' }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          {vendors.map(v => (
            <CircleMarker
              key={v.id}
              center={[v.lat, v.lng]}
              radius={v.isPremium ? 10 : 7}
              pathOptions={{
                color: v.isPremium ? '#B82010' : '#FFFFFF',
                fillColor: v.isPremium ? '#B82010' : '#FFFFFF',
                fillOpacity: 0.8,
                weight: 2
              }}
            >
              <Popup>
                <div style={{ background: '#1C1C1E', padding: '8px', borderRadius: '8px', color: '#FFFFFF' }}>
                  <p style={{ fontWeight: 600, fontSize: '15px' }}>{v.name}</p>
                  <p style={{ fontSize: '13px', color: '#A1A1A1' }}>{v.category} • {v.neighborhood}</p>
                </div>
              </Popup>
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
            >
              <Popup>
                <div style={{ background: '#1C1C1E', padding: '8px', borderRadius: '8px', color: '#FFFFFF' }}>
                  <p style={{ fontWeight: 600, fontSize: '15px' }}>{s.name}</p>
                  <p style={{ fontSize: '13px', color: '#A1A1A1' }}>{s.description}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <Dock />
    </main>
  )
}