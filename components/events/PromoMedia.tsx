// components/events/PromoMedia.tsx — the event page's hero: the promoter's
// media to swipe through, every video first and then every photo (Event.videos
// / Event.photos, plus the cover videoUrl / imageUrl). Videos autoplay muted
// with a "Tap for sound" button; progress bars at the top show where you are
// (a video's bar follows its playback, a photo's fills over 5 s). Swipe, or
// tap the left/right edges. The tapped card's image grows into it
// (lib/morph.ts). Reduce Motion: nothing plays or advances by itself.
// Low data: posters only.
'use client'

import { useEffect, useRef, useState } from 'react'
import Img from '@/components/Img'
import Icon from '@/lib/icons'
import { useLang } from '@/lib/i18n-client'
import { useReducedMotion } from '@/lib/motion'
import { useLowData } from '@/lib/low-data'
import { triggerHaptic } from '@/lib/haptics'
import { useMorphIn } from '@/lib/morph'

export interface PromoItem { kind: 'video' | 'photo'; url: string; poster: string | null }

/** Videos first, then photos, without repeats. */
export function promoItems(e: { videoUrl: string | null; imageUrl: string | null; videos?: string[]; photos?: string[] }): PromoItem[] {
  const videos = Array.from(new Set([e.videoUrl, ...(e.videos ?? [])].filter((u): u is string => Boolean(u))))
  const photos = Array.from(new Set([e.imageUrl, ...(e.photos ?? [])].filter((u): u is string => Boolean(u))))
  const poster = photos[0] ?? null
  return [...videos.map(url => ({ kind: 'video' as const, url, poster })), ...photos.map(url => ({ kind: 'photo' as const, url, poster: null }))]
}

const PHOTO_MS = 5000

export default function PromoMedia({ items, title, children }: { items: PromoItem[]; title: string; children?: React.ReactNode }) {
  const { t } = useLang()
  const reduce = useReducedMotion()
  const { lowData } = useLowData()
  const rootRef = useRef<HTMLDivElement>(null)
  const videos = useRef<Array<HTMLVideoElement | null>>([])
  const [i, setI] = useState(0)
  const [muted, setMuted] = useState(true)
  const [progress, setProgress] = useState(0)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const n = items.length
  const cur = items[i]
  useMorphIn(rootRef, true)

  const go = (d: number) => {
    if (n < 2) return
    triggerHaptic('selection')
    setI(x => (x + d + n) % n)
  }

  // Only the slide on screen plays.
  useEffect(() => {
    setProgress(0)
    videos.current.forEach((v, k) => {
      if (!v) return
      if (k === i && !reduce && !lowData) {
        v.muted = muted
        v.currentTime = 0
        v.play().catch(() => {})
      } else v.pause()
    })
  }, [i]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const v = videos.current[i]; if (v) v.muted = muted }, [muted, i])

  // Photos move on after a few seconds; videos when they end.
  useEffect(() => {
    if (reduce || n < 2 || !cur || (cur.kind === 'video' && !lowData)) return
    const start = Date.now()
    const tick = setInterval(() => setProgress(Math.min(1, (Date.now() - start) / PHOTO_MS)), 100)
    const next = setTimeout(() => setI(x => (x + 1) % n), PHOTO_MS)
    return () => { clearInterval(tick); clearTimeout(next) }
  }, [i, n, reduce, cur, lowData])

  const toggleSound = () => {
    triggerHaptic('light')
    const v = videos.current[i]
    const next = !muted
    setMuted(next)
    if (v) { v.muted = next; if (v.paused) v.play().catch(() => {}) }
  }

  return (
    <div
      ref={rootRef}
      className="pm"
      aria-roledescription="carousel"
      aria-label={title}
      onTouchStart={e => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }}
      onTouchEnd={e => {
        const s = touch.current
        touch.current = null
        if (!s) return
        const dx = e.changedTouches[0].clientX - s.x
        const dy = e.changedTouches[0].clientY - s.y
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
      }}
    >
      {n === 0 && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}><Icon name="party" size={48} /></div>}
      {items.map((m, k) => (
        <div key={m.url} className={`pm-slide ${k === i ? 'on' : ''}`} aria-hidden={k !== i}>
          {m.kind === 'video' && !lowData ? (
            <video
              ref={el => { videos.current[k] = el }}
              src={m.url}
              poster={m.poster ?? undefined}
              muted={muted}
              playsInline
              preload={k === 0 ? 'auto' : 'metadata'}
              autoPlay={k === 0 && !reduce}
              onTimeUpdate={e => { if (k === i && e.currentTarget.duration) setProgress(e.currentTarget.currentTime / e.currentTarget.duration) }}
              onEnded={() => { if (k === i && !reduce) setI(x => (n > 1 ? (x + 1) % n : x)) }}
              loop={n === 1}
            />
          ) : (
            <Img src={m.kind === 'video' ? m.poster ?? m.url : m.url} alt={k === 0 ? title : ''} width={1080} height={1200} sizes="100vw" priority={k === 0} />
          )}
        </div>
      ))}
      <div className="featured-hero-overlay" style={{ pointerEvents: 'none', zIndex: 2 }} />

      {n > 1 && (
        <>
          <button className="pm-zone" style={{ left: 0 }} aria-label={t('m.ev.prev')} onClick={() => go(-1)} />
          <button className="pm-zone" style={{ right: 0 }} aria-label={t('m.ev.next')} onClick={() => go(1)} />
          <div className="pm-bars" aria-label={t('m.ev.mediaN', { n: i + 1, total: n })} role="img">
            {items.map((m, k) => (
              <span key={m.url} className="mo-bar"><i style={{ width: k < i ? '100%' : k === i ? `${Math.round((reduce ? 1 : progress) * 100)}%` : '0%' }} /></span>
            ))}
          </div>
        </>
      )}

      {cur?.kind === 'video' && !lowData && (
        <button className="pm-sound" onClick={toggleSound} aria-pressed={!muted}>
          <Icon name="audio" size={14} /> {muted ? t('m.ev.tapSound') : t('m.ev.soundOn')}
        </button>
      )}
      {children}
    </div>
  )
}
