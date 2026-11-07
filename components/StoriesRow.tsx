// components/StoriesRow.tsx — Home's story rings for the selected region,
// from /api/stories?city=. Rings with stories the viewer hasn't seen get the
// colour ring (vendors' pulse a rum-red glow); seen ones go grey and stop
// (seen state is stored on the account).
// "Your Story" opens straight into the full-screen camera
// (components/stories/StoryCamera), then the editor (text, stickers,
// drawing; components/stories/StoryEditor), and posts for 24 hours to the
// current region — to everyone, or to close friends only. A vendor or event
// sticker gives the story its "Go here" / "Book this" button; without one,
// the server tags the vendor you QR-scanned at in the last few hours.
'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import { getCurrentUser } from '@/lib/auth-client'
import { apiJson } from '@/lib/api-client'
import StoryCamera, { type Captured } from '@/components/stories/StoryCamera'
import StoryEditor from '@/components/stories/StoryEditor'
import { useRegion } from '@/components/RegionProvider'
import { useTabShow } from '@/components/TabKeeper'
import { useLang } from '@/lib/i18n-client'
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
  /** A vendor's ring: unseen ones pulse a rum-red glow (app/home.css). */
  vendor: boolean
}

export default function StoriesRow() {
  const { t } = useLang()
  const { city, ready } = useRegion()
  const [rings, setRings] = useState<Ring[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [mine, setMine] = useState<Ring | null>(null)
  const [capture, setCapture] = useState<'camera' | Captured | null>(null)
  const [postError, setPostError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setFailed(false)
    try {
      const data: StoryRow[] = await apiJson(`/api/stories?city=${city}`)
      const me = getCurrentUser()?.id
      const groups = new Map<string, Ring>()
      let own: Ring | null = null
      for (const s of Array.isArray(data) ? data : []) {
        const key = s.vendorId || s.userId || s.id
        const ring = { key, name: s.vendor?.name || s.user?.name || 'ETA', image: s.vendor?.images?.[0] || s.user?.avatarUrl || s.imageUrl, bon: Boolean(s.vendor?.isPremium), unseen: !s.seen, vendor: Boolean(s.vendorId) }
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
  useTabShow('/', () => { if (ready) load() })

  const openCamera = () => {
    if (!getCurrentUser()) { setPostError(t('m.stories.loginToPost')); return }
    setPostError(null)
    triggerHaptic('medium')
    setCapture('camera')
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
            <button onClick={openCamera} aria-label={t('m.stories.add')} className="story-ring standard" style={{ border: 'none', cursor: 'pointer' }}>
              <span style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2px dashed var(--label-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-secondary)', background: 'var(--system-bg)' }}>
                <Icon name="camera" size={18} />
              </span>
            </button>
          )}
          {mine && (
            <button onClick={openCamera} aria-label={t('m.stories.add')} style={{ position: 'absolute', right: '-2px', top: '44px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--rum)', color: 'white', border: '2px solid var(--system-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
              <Icon name="plus" size={12} />
            </button>
          )}
          {label(t('m.stories.yours'))}
        </div>

        {failed ? (
          <button onClick={load} className="chip" style={{ alignSelf: 'center', fontSize: '13px', minHeight: '36px' }}>
            <Icon name="wave" size={14} /> {t('m.error.retry')}
          </button>
        ) : rings === null ? (
          [0, 1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0 }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)
        ) : rings.map(r => (
          <Link key={r.key} href={`/stories?start=${r.key}`} onClick={() => triggerHaptic('light')} style={{ textDecoration: 'none', textAlign: 'center', flexShrink: 0 }} aria-label={t('m.stories.open', { name: r.name })}>
            <div className={`story-ring ${r.bon ? 'premium' : 'standard'} ${r.unseen ? 'unseen' : 'seen'} ${r.vendor ? 'vendor' : ''}`}>
              <img src={r.image} alt="" loading="lazy" />
            </div>
            {label(r.name)}
          </Link>
        ))}
      </div>
      {postError && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '4px' }}>{postError}</p>}

      {capture === 'camera' && <StoryCamera onClose={() => setCapture(null)} onCaptured={c => setCapture(c)} />}
      {capture && capture !== 'camera' && <StoryEditor media={capture} onBack={() => setCapture('camera')} onPosted={() => { setCapture(null); load() }} />}
    </div>
  )
}
