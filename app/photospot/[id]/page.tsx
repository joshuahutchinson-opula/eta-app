// app/photospot/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

interface PhotoSpot {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  bestTime: string
  officialPhoto: string
  userPhotos: Array<{ id: string; url: string; caption: string | null; likes: number; uploadedBy: string }>
}

export default function PhotoSpotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [spot, setSpot] = useState<PhotoSpot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSpot()
  }, [])

  const fetchSpot = async () => {
    try {
      const response = await fetch(`/api/photospots/${params.id}`)
      const data = await response.json()
      setSpot(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid var(--glass-border)', borderTopColor: 'var(--rum)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </main>
    )
  }

  if (!spot) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'var(--sand-dim)' }}>Nuttin nuh go suh</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '80px' }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(15,14,12,0.5)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white'
        }}
      >
        <Icon name="back" size={14} />
      </button>

      <div style={{ position: 'relative', height: '300px' }}>
        <img src={spot.officialPhoto} alt={spot.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95))' }} />
        <div style={{ position: 'absolute', bottom: '14px', left: '14px', right: '14px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>{spot.name}</h1>
          <p style={{ fontSize: '13px', color: 'var(--sand-dim)' }}>{spot.description}</p>
          <p style={{ fontSize: '12px', color: 'var(--gold)', marginTop: '4px' }}>Best time: {spot.bestTime}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>User Photos</h2>
        {spot.userPhotos.length === 0 ? (
          <p style={{ color: 'var(--sand-dim)', textAlign: 'center', padding: '40px 0' }}>Nuh nuh photos yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {spot.userPhotos.map(photo => (
              <div key={photo.id} style={{ background: '#F5EFE6', padding: '8px 8px 14px', borderRadius: '4px', color: 'var(--black)' }}>
                <img src={photo.url} alt={photo.caption || spot.name} style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '2px' }} />
                {photo.caption && (
                  <p style={{ fontSize: '12px', fontWeight: 600, marginTop: '8px', textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic' }}>
                    {photo.caption}
                  </p>
                )}
                <p style={{ fontSize: '10px', color: '#666', textAlign: 'center', marginTop: '4px' }}>
                  @{photo.uploadedBy} • {photo.likes} likes
                </p>
              </div>
            ))}
          </div>
        )}

        <button className="btn-secondary" style={{ marginTop: '20px' }}>
          <Icon name="camera" size={18} />
          Add Your Shot
        </button>
      </div>

      <Dock />
    </main>
  )
}