// components/StoriesRow.tsx — Home's story rings, from /api/stories, plus
// "Your Story", which posts a photo story (24 hours) for the signed-in user.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { uploadPhoto } from '@/lib/api-client'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'

interface Story {
  id: string
  imageUrl: string
  vendorId: string | null
  userId: string | null
  vendor: { name: string; isPremium: boolean; images: string[] } | null
  user: { name: string; avatarUrl: string | null } | null
}

interface Ring {
  key: string
  name: string
  image: string
  bon: boolean
}

export default function StoriesRow() {
  const { t } = useLang()
  const [rings, setRings] = useState<Ring[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [mine, setMine] = useState<Ring | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const res = await fetch('/api/stories')
      if (!res.ok) throw new Error()
      const data: Story[] = await res.json()
      const me = getCurrentUser()?.id
      const groups = new Map<string, Ring>()
      let own: Ring | null = null
      for (const s of Array.isArray(data) ? data : []) {
        const key = s.vendorId || s.userId || s.id
        const ring = { key, name: s.vendor?.name || s.user?.name?.split(' ')[0] || 'ETA', image: s.vendor?.images?.[0] || s.user?.avatarUrl || s.imageUrl, bon: Boolean(s.vendor?.isPremium) }
        if (s.userId && s.userId === me) { own = own ?? { ...ring, image: s.imageUrl }; continue }
        if (!groups.has(key)) groups.set(key, ring)
      }
      setMine(own)
      // B.O.N vendors first, the rest in order of their latest story.
      setRings(Array.from(groups.values()).sort((a, b) => Number(b.bon) - Number(a.bon)))
    } catch {
      setFailed(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const postStory = async (file: File) => {
    const user = getCurrentUser()
    if (!user) { setPostError(t('m.stories.loginToPost')); return }
    setPosting(true)
    setPostError(null)
    try {
      const imageUrl = await uploadPhoto(file, 'stories')
      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '', type: 'user', imageUrl, userId: user.id, expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() })
      })
      if (!res.ok) throw new Error()
      triggerHaptic('medium')
      await load()
    } catch (e) {
      setPostError(e instanceof Error && e.message ? e.message : t('m.stories.postFailed'))
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
            <Link href={`/stories?start=${mine.key}`} aria-label={t('m.stories.yours')} className="story-ring premium" style={{ display: 'flex' }}>
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
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) postStory(f) }} />
        </div>

        {failed ? (
          <button onClick={load} className="chip" style={{ alignSelf: 'center', fontSize: '13px', minHeight: '36px' }}>
            <Icon name="wave" size={14} /> {t('m.error.retry')}
          </button>
        ) : rings === null ? (
          [0, 1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : rings.map(r => (
          <Link key={r.key} href={`/stories?start=${r.key}`} onClick={() => triggerHaptic('light')} style={{ textDecoration: 'none', textAlign: 'center', flexShrink: 0 }} aria-label={t('m.stories.open', { name: r.name })}>
            <div className={`story-ring ${r.bon ? 'premium' : 'standard'}`}>
              <img src={r.image} alt="" />
            </div>
            {label(r.name)}
          </Link>
        ))}
      </div>
      {postError && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{postError}</p>}
    </div>
  )
}
