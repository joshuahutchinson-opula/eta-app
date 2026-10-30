// app/photospot/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { uploadPhoto } from '@/lib/api-client'
import PhotoPicker from '@/components/PhotoPicker'
import CheckInButton from '@/components/CheckInButton'
import ErrorState from '@/components/ErrorState'
import { useLang } from '@/lib/i18n-client'

interface PhotoSpot {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  bestTime: string
  officialPhoto: string
  gallery: string[]
  videos: string[]
  userPhotos: Array<{ id: string; url: string; caption: string | null; likes: number; uploadedBy: string }>
}

export default function PhotoSpotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [spot, setSpot] = useState<PhotoSpot | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [photo, setPhoto] = useState<File | null>(null)
  const [postError, setPostError] = useState<string | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const { t } = useLang()
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    fetchSpot()
  }, [])

  const fetchSpot = async () => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const response = await fetch(`/api/photospots/${params.id}`)
      if (response.status === 404) { setSpot(null); return }
      if (!response.ok) throw new Error()
      const data = await response.json()
      setSpot(data)
    } catch (error) {
      console.error(error)
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }

  const handleAddShotClick = () => {
    const user = getCurrentUser()
    if (!user) {
      alert('Log in to add your shot')
      router.push('/login')
      return
    }
    setShowAddSheet(true)
  }

  const submitShot = async () => {
    const user = getCurrentUser()
    if (!user) {
      alert('Log in to add your shot')
      router.push('/login')
      return
    }
    if (!photo) return

    setSubmitting(true)
    setPostError(null)
    try {
      const url = await uploadPhoto(photo, 'moments')
      const body: Record<string, unknown> = {
        userId: user.id,
        photoSpotId: params.id,
        url
      }
      if (caption.trim()) body.caption = caption.trim()

      const response = await fetch('/api/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!response.ok) throw new Error(t('m.photo.postFailed'))
      const newMoment = await response.json()

      setSpot(prev => prev
        ? {
            ...prev,
            userPhotos: [
              { id: newMoment.id, url: newMoment.url, caption: newMoment.caption ?? null, likes: newMoment.likes ?? 0, uploadedBy: user.name },
              ...prev.userPhotos
            ]
          }
        : prev)

      setShowAddSheet(false)
      setPhoto(null)
      setCaption('')
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

  if (!spot) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        {loadFailed ? <ErrorState onRetry={fetchSpot} /> : <p style={{ color: 'var(--label-secondary)' }}>Nuttin nuh go suh</p>}
      </main>
    )
  }

  const images = spot.gallery?.length ? spot.gallery : [spot.officialPhoto]

  return (
    <main className="screen-push-in" style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '80px' }}>
      {/* Back button */}
      <button
        onClick={() => router.back()}
        aria-label="Back"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          zIndex: 10,
          width: '44px',
          height: '44px',
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

      <div style={{ position: 'relative', height: '340px' }}>
        {/* Swipeable gallery; the cover photo leads */}
        <div
          onScroll={e => setSlide(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          style={{ display: 'flex', height: '100%', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
        >
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`${spot.name} — photo ${i + 1}`}
              loading={i === 0 ? 'eager' : 'lazy'}
              style={{ flex: '0 0 100%', width: '100%', height: '100%', objectFit: 'cover', scrollSnapAlign: 'start' }}
            />
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 40%, rgba(15,14,12,0.95))', pointerEvents: 'none' }} />
        {images.length > 1 && (
          <span style={{ position: 'absolute', top: '18px', right: '16px', padding: '4px 10px', borderRadius: '999px', background: 'rgba(15,14,12,0.5)', color: 'white', fontSize: '12px', fontWeight: 700, pointerEvents: 'none' }}>
            {slide + 1} / {images.length}
          </span>
        )}
        <div style={{ position: 'absolute', bottom: '14px', left: '14px', right: '14px', pointerEvents: 'none' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#fff' }}>{spot.name}</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>{spot.description}</p>
          <p style={{ fontSize: '12px', color: 'var(--gold)', marginTop: '4px' }}>Best time: {spot.bestTime}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <CheckInButton target={{ kind: 'photospot', id: spot.id, lat: spot.lat, lng: spot.lng }} />

        {spot.videos.length > 0 && (
          <>
            <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>Videos</h2>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', margin: '0 -16px 24px', padding: '0 16px', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
              {spot.videos.map(src => (
                <video
                  key={src}
                  src={src}
                  poster={src.replace(/\.mp4$/i, '.jpg')}
                  controls
                  playsInline
                  preload="none"
                  style={{ flex: '0 0 auto', width: '160px', height: '284px', objectFit: 'cover', borderRadius: 'var(--radius-lg)', background: '#000', scrollSnapAlign: 'start' }}
                />
              ))}
            </div>
          </>
        )}

        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>User Photos</h2>
        {spot.userPhotos.length === 0 ? (
          <p style={{ color: 'var(--label-secondary)', textAlign: 'center', padding: '40px 0' }}>Nuh nuh photos yet</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {spot.userPhotos.map(photo => (
              <div key={photo.id} className="polaroid">
                <img src={photo.url} alt={photo.caption || spot.name} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
                {photo.caption && (
                  <p className="polaroid-caption">
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

        <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={handleAddShotClick}>
          <Icon name="camera" size={18} />
          Add Your Shot
        </button>
      </div>

      {/* Add Your Shot sheet */}
      <div className={`bottom-sheet-overlay ${showAddSheet ? 'open' : ''}`} onClick={() => setShowAddSheet(false)} />
      <div className={`bottom-sheet ${showAddSheet ? 'open' : ''}`}>
        <div className="sheet-grabber" />
        <div style={{ padding: '0 20px 20px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>Add Your Shot</h3>

          <PhotoPicker file={photo} onChange={setPhoto} />

          <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--label-secondary)', marginBottom: '6px' }}>Caption (optional)</p>
          <input
            type="text"
            placeholder="Say something about it..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--separator)',
              background: 'var(--system-bg)',
              color: 'var(--label-primary)',
              fontSize: '15px',
              marginBottom: '20px',
              fontFamily: 'inherit'
            }}
          />

          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={submitShot}
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
