// app/accommodation/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import SuccessAnimation from '@/components/SuccessAnimation'

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
  const router = useRouter()
  const [accom, setAccom] = useState<Accommodation | null>(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

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

  const handleBook = async () => {
    const user = getCurrentUser()
    if (!user) {
      alert('Log in to book')
      router.push('/login')
      return
    }
    if (!accom || booking || booked) return

    setBooking(true)
    try {
      const date = new Date()
      date.setDate(date.getDate() + 7)
      const totalPrice = parseFloat((accom.priceRange || '').replace(/[^0-9.]/g, '')) || 0

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          accommodationId: params.id,
          date: date.toISOString(),
          totalPrice,
          pointsEarned: 0,
          status: 'CONFIRMED'
        })
      })

      if (!response.ok) throw new Error('Booking failed')

      setBooked(true)
      setShowSuccess(true)
    } catch (error) {
      console.error(error)
    } finally {
      setBooking(false)
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid var(--separator)', borderTopColor: 'var(--rum)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </main>
    )
  }

  if (!accom) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'var(--label-secondary)' }}>Nuttin nuh go suh</p>
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

      <div style={{ position: 'relative', height: '280px' }}>
        <img src={accom.media?.[0]?.url || ''} alt={accom.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95))' }} />
        <div style={{ position: 'absolute', bottom: '14px', left: '14px', right: '14px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>{accom.name}</h1>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>
            ★ {accom.googleStars} • {accom.priceRange}
          </p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '15px', color: 'var(--label-secondary)', marginBottom: '16px' }}>{accom.description}</p>

        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Amenities</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {accom.amenities.map(amenity => (
            <span
              key={amenity}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                color: 'var(--label-primary)',
                background: 'var(--system-bg-elevated)',
                boxShadow: 'var(--shadow-card)',
                borderRadius: 'var(--radius-full)'
              }}
            >
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

        <button
          className="btn btn-primary"
          style={{ marginTop: '20px' }}
          onClick={handleBook}
          disabled={booking || booked}
        >
          {booked ? 'Booked!' : booking ? 'Booking...' : 'Book dis'}
        </button>
      </div>

      <SuccessAnimation show={showSuccess} onComplete={() => setShowSuccess(false)} />
    </main>
  )
}
