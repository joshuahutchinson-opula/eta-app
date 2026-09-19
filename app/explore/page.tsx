// app/explore/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Dock from '@/components/Dock'
import FloatingPill from '@/components/FloatingPill'
import ExploreMap, { type MapVendor, type MapPhotoSpot } from '@/components/ExploreMap'

export default function ExplorePage() {
  const [vendors, setVendors] = useState<MapVendor[]>([])
  const [photoSpots, setPhotoSpots] = useState<MapPhotoSpot[]>([])
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
      setVendors(vendorsData.filter((v: MapVendor) => v.visibleOnMap && !v.isTransport))
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
      <FloatingPill />
      <div style={{ flex: 1, position: 'relative' }}>
        <ExploreMap vendors={vendors} photoSpots={photoSpots} />
      </div>
      <Dock />
    </main>
  )
}
