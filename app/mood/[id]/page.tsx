'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import TopBar from '@/components/TopBar'
import Dock from '@/components/Dock'
import Icon from '@/lib/icons'

interface Mood {
  id: string
  name: string
  description: string
  coverImage: string
  icon: string
  media: Array<{ id: string; type: string; url: string; uploadedBy: string }>
}

export default function MoodDetailPage() {
  const params = useParams()
  const [mood, setMood] = useState<Mood | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMood()
  }, [])

  const fetchMood = async () => {
    try {
      const response = await fetch(`/api/moods/${params.id}`)
      const data = await response.json()
      setMood(data)
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

  if (!mood) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ color: 'var(--sand-dim)' }}>Nuttin nuh go suh</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '120px' }}>
      <TopBar />

      <div style={{ position: 'relative', height: '200px' }}>
        <img src={mood.coverImage} alt={mood.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95))' }} />
        <div style={{ position: 'absolute', bottom: '14px', left: '14px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>{mood.name}</h1>
          <p style={{ fontSize: '13px', color: 'var(--sand-dim)' }}>{mood.description}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Photos</h2>
        {mood.media.length === 0 ? (
          <p style={{ color: 'var(--sand-dim)', textAlign: 'center', padding: '40px 0' }}>Nuh nuh photos yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {mood.media.map(m => (
              <div key={m.id} style={{ borderRadius: '12px', overflow: 'hidden' }}>
                <img src={m.url} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
                <p style={{ fontSize: '10px', color: 'var(--sand-dim)', marginTop: '4px' }}>
                  @{m.uploadedBy}
                </p>
              </div>
            ))}
          </div>
        )}

        <button className="btn-secondary" style={{ marginTop: '20px' }}>
          <Icon name="camera" size={18} />
          Add Your Moment
        </button>
      </div>

      <Dock />
    </main>
  )
}