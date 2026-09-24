// components/web/AutoVideo.tsx
'use client'

import { useEffect, useRef } from 'react'

/** Muted looping background video. React doesn't emit `muted` during SSR, so it's set on mount before play(). */
export default function AutoVideo({ src, poster, className, style }: { src: string; poster?: string | null; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = true
    el.play().catch(() => {})
  }, [src])
  return (
    <video
      ref={ref}
      src={src}
      poster={poster ?? undefined}
      className={className}
      style={style}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
    />
  )
}
