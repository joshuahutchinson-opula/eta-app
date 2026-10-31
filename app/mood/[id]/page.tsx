// app/mood/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { apiJson, uploadPhoto } from '@/lib/api-client'
import PhotoPicker from '@/components/PhotoPicker'
import ErrorState from '@/components/ErrorState'
import { useErrorText, useLang } from '@/lib/i18n-client'
import ReportButton from '@/components/ReportButton'
import BackButton from '@/components/BackButton'
import Img from '@/components/Img'

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
  const errorText = useErrorText()
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
      alert(t('m.photo.loginToAddMoment'))
      router.push('/login')
      return
    }
    setShowAddSheet(true)
  }

  const submitMoment = async () => {
    const user = getCurrentUser()
    if (!user) {
      alert(t('m.photo.loginToAddMoment'))
      router.push('/login')
      return
    }
    if (!photo) return

    setSubmitting(true)
    setPostError(null)
    try {
      const url = await uploadPhoto(photo, 'mood-media')
      const newMedia = await apiJson('/api/moodmedia', { method: 'POST', body: { moodId: params.id, url, type: 'image' } })

      setMood(prev => prev
        ? { ...prev, media: [newMedia, ...prev.media] }
        : prev)

      setShowAddSheet(false)
      setPhoto(null)
    } catch (error) {
      console.error(error)
      setPostError(errorText(error))
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
        {loadFailed ? <ErrorState onRetry={fetchMood} /> : <p style={{ color: 'var(--label-secondary)' }}>{t('m.err.notFound')}</p>}
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', position: 'relative', zIndex: 1, paddingBottom: '80px' }}>
      {/* Back button */}
      <BackButton floating fallback="/" />

      <div style={{ position: 'relative', height: '200px' }}>
        {mood.coverImage && <Img src={mood.coverImage} alt={mood.name} width={1200} height={800} priority />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent, rgba(15,14,12,0.95))' }} />
        <div style={{ position: 'absolute', bottom: '14px', left: '14px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>{mood.name}</h1>
          <p style={{ fontSize: '13px', color: 'var(--label-secondary)' }}>{mood.description}</p>
        </div>
      </div>

      <div style={{ padding: '16px' }}>
        <h2 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '12px' }}>{t('m.photo.photos')}</h2>
        {mood.media.length === 0 ? (
          <p style={{ color: 'var(--label-secondary)', textAlign: 'center', padding: '40px 0' }}>{t('m.photo.none')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {mood.media.map(m => (
              <div key={m.id} style={{ borderRadius: '12px', overflow: 'hidden', position: 'relative' }}>
                <Img src={m.url} alt="" width={400} height={240} sizes="50vw" style={{ height: '120px', display: 'block' }} />
                <span style={{ position: 'absolute', top: '6px', right: '6px' }}><ReportButton targetType="MOOD_MEDIA" targetId={m.id} tone="light" /></span>
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
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '16px' }}>{t('m.photo.addMoment')}</h3>

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
