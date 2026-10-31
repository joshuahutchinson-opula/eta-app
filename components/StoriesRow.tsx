// components/StoriesRow.tsx — Home's story rings for the selected region,
// from /api/stories?city=. Rings with stories the viewer hasn't seen get the
// colour ring; seen ones go grey (seen state is stored on the account).
// "Your Story" posts a photo or short video with an optional caption for
// 24 hours, tagged with the current region.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { apiJson, uploadMedia } from '@/lib/api-client'
import { useRegion } from '@/components/RegionProvider'
import { useErrorText, useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

export interface StoryRow {
  id: string
  imageUrl: string
  videoUrl: string | null
  content: string
  vendorId: string | null
  userId: string | null
  seen: boolean
  vendor: { name: string; isPremium: boolean; images: string[] } | null
  user: { name: string; avatarUrl: string | null } | null
}

interface Ring {
  key: string
  name: string
  image: string
  bon: boolean
  unseen: boolean
}

export default function StoriesRow() {
  const { t } = useLang()
  const errorText = useErrorText()
  const { city, town, ready } = useRegion()
  const [rings, setRings] = useState<Ring[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [mine, setMine] = useState<Ring | null>(null)
  const [draft, setDraft] = useState<{ file: File; preview: string; video: boolean } | null>(null)
  const [caption, setCaption] = useState('')
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const data: StoryRow[] = await apiJson(`/api/stories?city=${city}`)
      const me = getCurrentUser()?.id
      const groups = new Map<string, Ring>()
      let own: Ring | null = null
      for (const s of Array.isArray(data) ? data : []) {
        const key = s.vendorId || s.userId || s.id
        const ring = { key, name: s.vendor?.name || s.user?.name || 'ETA', image: s.vendor?.images?.[0] || s.user?.avatarUrl || s.imageUrl, bon: Boolean(s.vendor?.isPremium), unseen: !s.seen }
        if (s.userId && s.userId === me) { own = own ?? { ...ring, image: s.imageUrl, unseen: false }; continue }
        const prev = groups.get(key)
        if (!prev) groups.set(key, ring)
        else if (ring.unseen) prev.unseen = true
      }
      setMine(own)
      // Unseen first, then B.O.N vendors, then the rest in order of their latest story.
      setRings(Array.from(groups.values()).sort((a, b) => Number(b.unseen) - Number(a.unseen) || Number(b.bon) - Number(a.bon)))
    } catch {
      setFailed(true)
    }
  }, [city])

  useEffect(() => { if (ready) load() }, [ready, load])

  const pick = (file: File) => {
    if (!getCurrentUser()) { setPostError(t('m.stories.loginToPost')); return }
    setPostError(null)
    setCaption('')
    setDraft({ file, preview: URL.createObjectURL(file), video: file.type.startsWith('video/') })
  }

  const closeDraft = () => {
    if (draft) URL.revokeObjectURL(draft.preview)
    setDraft(null)
  }

  const post = async () => {
    if (!draft) return
    setPosting(true)
    setPostError(null)
    try {
      const media = await uploadMedia(draft.file, 'stories')
      await apiJson('/api/stories', {
        method: 'POST',
        body: media.kind === 'video'
          ? { imageUrl: media.poster ?? media.url, videoUrl: media.url, caption: caption.trim() || undefined, city }
          : { imageUrl: media.url, caption: caption.trim() || undefined, city }
      })
      triggerHaptic('medium')
      closeDraft()
      await load()
    } catch (e) {
      setPostError(errorText(e))
    } finally {
      setPosting(false)
    }
  }

  const label = (text: string) => (
    <p style={{ fontSize: '11px', fontWeight: 500, color: 'var(--label-secondary)', marginTop: '4px', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</p>
  )

  return (
    <div style={{ padding: '8px 16px 0' }}>
      <div className="horizontal-scroll" style={{ padding: '0 0 4px' }}>
        <div style={{ textAlign: 'center', flexShrink: 0, position: 'relative' }}>
          {mine ? (
            <Link href={`/stories?start=${mine.key}`} aria-label={t('m.stories.yours')} className="story-ring seen" style={{ display: 'flex' }}>
              <img src={mine.image} alt="" />
            </Link>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={posting} aria-label={t('m.stories.add')} className="story-ring standard" style={{ border: 'none', cursor: 'pointer' }}>
              <span style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--label-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-secondary)', background: 'var(--system-bg)' }}>
                <Icon name={posting ? 'clock' : 'camera'} size={18} />
              </span>
            </button>
          )}
          {mine && (
            <button onClick={() => fileRef.current?.click()} disabled={posting} aria-label={t('m.stories.add')} style={{ position: 'absolute', right: '-2px', top: '44px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--rum)', color: 'white', border: '2px solid var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <Icon name="plus" size={12} />
            </button>
          )}
          {label(posting ? t('m.stories.posting') : t('m.stories.yours'))}
          <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f) }} />
        </div>

        {failed ? (
          <button onClick={load} className="chip" style={{ alignSelf: 'center', fontSize: '13px', minHeight: '36px' }}>
            <Icon name="wave" size={14} /> {t('m.error.retry')}
          </button>
        ) : rings === null ? (
          [0, 1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : rings.map(r => (
          <Link key={r.key} href={`/stories?start=${r.key}`} onClick={() => triggerHaptic('light')} style={{ textDecoration: 'none', textAlign: 'center', flexShrink: 0 }} aria-label={t('m.stories.open', { name: r.name })}>
            <div className={`story-ring ${r.bon ? 'premium' : 'standard'} ${r.unseen ? 'unseen' : 'seen'}`}>
              <img src={r.image} alt="" loading="lazy" />
            </div>
            {label(r.name)}
          </Link>
        ))}
      </div>
      {postError && !draft && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{postError}</p>}

      <div className={`bottom-sheet-overlay ${draft ? 'open' : ''}`} onClick={posting ? undefined : closeDraft} />
      <div className={`bottom-sheet ${draft ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('m.stories.newTitle')}>
        <div className="sheet-grabber" />
        {draft && (
          <div style={{ padding: '0 20px 24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--label-primary)', marginBottom: '12px' }}>{t('m.stories.newTitle')}</h3>
            <div style={{ borderRadius: '16px', overflow: 'hidden', height: '280px', background: '#000', marginBottom: '12px' }}>
              {draft.video
                ? <video src={draft.preview} muted loop playsInline autoPlay style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <img src={draft.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <input
              value={caption}
              maxLength={200}
              onChange={e => setCaption(e.target.value)}
              placeholder={t('m.stories.captionPlaceholder')}
              aria-label={t('m.stories.captionPlaceholder')}
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid var(--separator)', background: 'var(--system-bg)', fontSize: '16px', fontFamily: 'inherit', color: 'var(--label-primary)', marginBottom: '8px', minHeight: '44px' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--label-secondary)', marginBottom: '12px' }}>{t('m.stories.lasts', { town: town.name })}</p>
            {postError && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{postError}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-tertiary" onClick={closeDraft} disabled={posting} style={{ flex: 1 }}>{t('m.book.cancel')}</button>
              <button className="btn btn-primary" onClick={post} disabled={posting} style={{ flex: 2 }}>{posting ? t('m.stories.posting') : t('m.stories.post')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
