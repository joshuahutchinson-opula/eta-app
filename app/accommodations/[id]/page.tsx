'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

interface Accommodation {
  id: string
  name: string
  type: string
  googleStars: number
  description: string
  amenities: string[]
  priceRange: string
  media: Array<{ type: string; url: string }>
  roomViews: string[]
}

export default function AccommodationDetailPage() {
  const params = useParams()
  const [accom, setAccom] = useState<Accommodation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAccom()
  }, [])

  const fetchAccom = async () => {
    try {
      const response = await fetch(`/api/accommodations/${params.id}`)
      const data = await response.json()
      setAccom(data)
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

  if (!accom) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'var(--sand-dim)' }}>Nuttin nuh go suh</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '120px' }}>
      <TopBar />

      <div style={{ position: 'relative', height: '280px' }}>
        <img src={accom.media?.[0]?.url || ''} alt={accom.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95))' }} />
        <div style={{ position: 'absolute', bottom: '14px', left: '14px', right: '14px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>{accom.name}</h1>
          <p style={{ fontSize: '13px', color: 'var(--sand-dim)' }}>
            ★ {accom.googleStars} • {accom.priceRange}
          </p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '15px', color: 'var(--sand-dim)', marginBottom: '16px' }}>{accom.description}</p>

        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Amenities</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {accom.amenities.map(amenity => (
            <span key={amenity} className="glass-pill" style={{ padding: '6px 12px', fontSize: '12px' }}>
              {amenity}
            </span>
          ))}
        </div>

        {accom.roomViews.length > 0 && (
          <>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>View From Your Room</h2>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {accom.roomViews.map((view, i) => (
                <img key={i} src={view} alt={`Room view ${i + 1}`} style={{ width: '200px', height: '140px', objectFit: 'cover', borderRadius: '12px', flexShrink: 0 }} />
              ))}
            </div>
          </>
        )}

        <button className="btn-primary" style={{ marginTop: '20px' }}>
          Book dis
        </button>
      </div>

      <Dock />
    </main>
  )
}