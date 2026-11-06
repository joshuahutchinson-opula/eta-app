// components/home/HomeHero.tsx — Home's hero: a real photo or a short muted
// loop of the selected town for the daypart (TownMedia, lib/home.ts), or
// the town's best vendor photo when none has been uploaded. A photo drifts
// and zooms very slowly. On a party night it shows tonight's big event
// instead. About 270px with a bottom scrim; the top bar (location + points)
// and the bottom-left text come from the page.
//   pull      pulling down at the top stretches and zooms it (before the
//             refresh wave runs)
//   sceneKey  changing town crossfades to the new media
//   washKey   bump to send a wave across (pull to refresh)
// Reduce motion: no drift, no zoom, posters instead of video, cuts instead
// of fades.
'use client'

import { useEffect, useRef, useState } from 'react'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import { useReducedMotion } from '@/lib/motion'
import type { HeroMedia } from '@/lib/home'

export const HERO_HEIGHT = 270
const FADE_MS = 900

export interface HeroLayerMedia { kind: 'photo' | 'video'; url: string; poster: string | null }

interface Props {
  media: HeroLayerMedia | HeroMedia | null
  sceneKey: string
  pull: number
  washKey: number
  topBar: React.ReactNode
  children?: React.ReactNode
  /** Taller for the countdown hero. */
  height?: number
}

interface Layer { key: string; media: HeroLayerMedia | null; leaving: boolean }

function Media({ media, reduce }: { media: HeroLayerMedia | null; reduce: boolean }) {
  if (!media) return <div className="home-hero-fallback" aria-hidden />
  if (media.kind === 'video' && !reduce) return <SmartVideo src={media.url} poster={media.poster} />
  const src = media.kind === 'video' ? media.poster ?? media.url : media.url
  return <div className={`home-hero-photo ${reduce ? '' : 'drift'}`}><Img src={src} alt="" width={1290} height={900} sizes="100vw" priority /></div>
}

export default function HomeHero({ media, sceneKey, pull, washKey, topBar, children, height = HERO_HEIGHT }: Props) {
  const reduce = useReducedMotion()
  const waveRef = useRef<HTMLDivElement>(null)
  const mediaKey = `${sceneKey}|${media?.url ?? 'none'}`
  const [layers, setLayers] = useState<Layer[]>([{ key: mediaKey, media: media ?? null, leaving: false }])

  // A new town (or daypart, or party night): fade the new media in over the old.
  useEffect(() => {
    setLayers(prev => {
      if (prev[prev.length - 1]?.key === mediaKey) return prev
      if (reduce) return [{ key: mediaKey, media: media ?? null, leaving: false }]
      return [...prev.map(l => ({ ...l, leaving: true })), { key: mediaKey, media: media ?? null, leaving: false }]
    })
    if (reduce) return
    const timer = setTimeout(() => setLayers(prev => prev.filter(l => !l.leaving)), FADE_MS)
    return () => clearTimeout(timer)
  }, [mediaKey, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!washKey || reduce) return
    const el = waveRef.current
    if (!el) return
    el.classList.remove('hero-wash-run')
    void el.offsetWidth
    el.classList.add('hero-wash-run')
  }, [washKey, reduce])

  const stretch = reduce ? 0 : pull
  return (
    <div className="home-hero" style={{ height: `${height + stretch}px`, transition: pull ? 'none' : 'height 0.5s var(--spring-standard)' }}>
      <div className="home-hero-media" style={{ transform: stretch ? `scale(${1 + stretch / 320})` : undefined, transition: pull ? 'none' : 'transform 0.5s var(--spring-standard)' }}>
        {layers.map((l, i) => (
          <div key={l.key} className={`home-hero-layer-media ${l.leaving ? 'leaving' : i > 0 ? 'entering' : ''}`}>
            <Media media={l.media} reduce={reduce} />
          </div>
        ))}
      </div>
      <div ref={waveRef} className="hero-wash" aria-hidden>
        <svg viewBox="0 0 400 600" preserveAspectRatio="none"><path d="M0 0 H300 C360 80 280 150 340 230 C400 310 300 380 350 460 C390 530 330 570 360 600 H0 Z" fill="rgba(255,255,255,0.55)" /><path d="M0 0 H270 C330 80 250 150 310 230 C370 310 270 380 320 460 C360 530 300 570 330 600 H0 Z" fill="rgba(210,240,255,0.5)" /></svg>
      </div>
      <div className="home-hero-scrim" aria-hidden />
      <div className="home-hero-top">{topBar}</div>
      <div className="home-hero-bottom">{children}</div>
    </div>
  )
}
