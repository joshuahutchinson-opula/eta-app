// components/web/MediaGallery.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  name: string
  videos: string[]
  images: string[]
}

/** Videos first, then images, with a thumbnail strip underneath. */
export default function MediaGallery({ name, videos, images }: Props) {
  const media = [
    ...videos.map(src => ({ type: 'video' as const, src })),
    ...images.map(src => ({ type: 'image' as const, src }))
  ]
  const [index, setIndex] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)
  const current = media[index]

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = true
    el.play().catch(() => {})
  }, [index])

  if (!current) return <div className="w-gallery-main" />

  return (
    <div>
      <div className="w-gallery-main">
        {current.type === 'video' ? (
          <video
            key={current.src}
            ref={videoRef}
            src={current.src}
            poster={images[0]}
            muted
            loop
            playsInline
            autoPlay
            controls
            preload="metadata"
          />
        ) : (
          <img key={current.src} src={current.src} alt={`${name} — photo ${index - videos.length + 1}`} />
        )}
      </div>
      {media.length > 1 ? (
        <div className="w-thumbs" role="list" aria-label="Media">
          {media.map((m, i) => (
            <button
              key={`${m.type}-${m.src}`}
              type="button"
              role="listitem"
              className="w-thumb"
              aria-current={i === index}
              aria-label={m.type === 'video' ? `Video ${i + 1}` : `Photo ${i - videos.length + 1}`}
              onClick={() => setIndex(i)}
            >
              {m.type === 'video' ? (
                <>
                  {images[0] ? <img src={images[0]} alt="" /> : <video src={m.src} muted preload="metadata" />}
                  <span className="w-thumb-play" aria-hidden>▶</span>
                </>
              ) : (
                <img src={m.src} alt="" loading="lazy" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
