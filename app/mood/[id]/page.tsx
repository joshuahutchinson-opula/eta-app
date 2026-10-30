// app/mood/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { uploadPhoto } from '@/lib/api-client'
import PhotoPicker from '@/components/PhotoPicker'
import ErrorState from '@/components/ErrorState'
import { useLang } from '@/lib/i18n-client'

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
  const router = useRouter()
  const [mood, setMood] = useState<Mood | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [postError, setPostError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const { t } = useLang()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchMood()
  }, [])

  const fetchMood = async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const response = await fetch(`/api/moods/${params.id}`)
      if (response.status === 404) { setMood(null); return }
      if (!response.ok) throw new Error()
      const data = await response.json()
      setMood(data)
    } catch (error) {
      console.error(error)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const handleAddMomentClick = () => {
    const user = getCurrentUser()
    if (!user) {
      alert('Log in to add your moment')
      router.push('/login')
      return
    }
    setShowAddSheet(true)
  }

  const submitMoment = async () => {
    const user = getCurrentUser()
    if (!user) {
      alert('Log in to add your moment')
      router.push('/login')
      return
    }
    if (!photo) return

    setSubmitting(true)
    setPostError(null)
    try {
      const url = await uploadPhoto(photo, 'mood-media')
      const body = {
        moodId: params.id,
        url,
        type: 'image',
        uploadedBy: user.name
      }

      const response = await fetch('/api/moodmedia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error(t('m.photo.postFailed'))
      const newMedia = await response.json()

      setMood(prev => prev
        ? { ...prev, media: [newMedia, ...prev.media] }
        : prev)

      setShowAddSheet(false)
      setPhoto(null)
    } catch (error) {
      console.error(error)
      setPostError(error instanceof Error ? error.message : t('m.photo.postFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid var(--separator)', borderTopColor: 'var(--rum)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </main>
    )
  }

  if (!mood) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {loadFailed ? <ErrorState onRetry={fetchMood} /> : <p style={{ color: 'var(--label-secondary)' }}>Nuttin nuh go suh</p>}
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '80px' }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        aria-label="Back"
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

      <div style={{ position: 'relative', height: '200px' }}>
        <img src={mood.coverImage} alt={mood.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95))' }} />
        <div style={{ position: 'absolute', bottom: '14px', left: '14px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>{mood.name}</h1>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{mood.description}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Photos</h2>
        {mood.media.length === 0 ? (
          <p style={{ color: 'var(--label-secondary)', textAlign: 'center', padding: '40px 0' }}>Nuh nuh photos yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {mood.media.map(m => (
              <div key={m.id} style={{ borderRadius: '12px', overflow: 'hidden' }}>
                <img src={m.url} alt="" style={{ width: '100%', height: '120px', objectFit: 'cover', display: 'block' }} />
                <p style={{ fontSize: '10px', color: 'var(--label-secondary)', marginTop: '4px' }}>
                  @{m.uploadedBy}
                </p>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={handleAddMomentClick}>
          <Icon name="camera" size={18} />
          Add Your Moment
        </button>
      </div>

      {/* Add Your Moment sheet */}
      <div className={`bottom-sheet-overlay ${showAddSheet ? 'open' : ''}`} onClick={() => setShowAddSheet(false)} />
      <div className={`bottom-sheet ${showAddSheet ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>Add Your Moment</h3>

          <PhotoPicker file={photo} onChange={setPhoto} />

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={submitMoment}
            disabled={submitting || !photo}
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
          {postError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginTop: '8px' }}>{postError}</p>}
        </div>
      </div>
    </main>
  )
}
