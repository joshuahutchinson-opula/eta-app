// components/SmartVideo.tsx — a muted looping video that only plays while
// it's on screen (IntersectionObserver) and pauses the moment it scrolls
// away, so only the visible video uses data and battery. In Low data mode
// (lib/low-data.ts) it shows the poster image and never loads the video.
'use client'

import { useEffect, useRef } from 'react'
import Img from '@/components/Img'
import { useLowData } from '@/lib/low-data'

interface Props {
  src: string
  poster?: string | null
  alt?: string
  /** Extra condition, e.g. only the current carousel slide plays. */
  active?: boolean
  style?: React.CSSProperties
}

export default function SmartVideo({ src, poster, alt = '', active = true, style }: Props) {
  const { lowData } = useLowData()
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || lowData) return
    let visible = false
    const sync = () => {
      if (visible && active && document.visibilityState === 'visible') {
        el.muted = true
        el.play().catch(() => {})
      } else {
        el.pause()
      }
    }
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= 0.5; sync() }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    document.addEventListener('visibilitychange', sync)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', sync); el.pause() }
  }, [lowData, active, src])

  const fill: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }

  if (lowData) {
    return poster ? <Img src={poster} alt={alt} width={1080} height={1350} style={style} /> : <div aria-hidden style={{ ...fill, background: 'var(--system-bg-secondary)' }} />
  }
  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt || undefined}
      style={fill}
    />
  )
}
