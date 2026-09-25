// components/web/MediaGallery.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  name: string
  videos: string[]
  images: string[]
  /** Photo spots lead with their cover photo; experiences lead with video. */
  leadWith?: 'videos' | 'images'
}

/** Cloudinary serves a still of any video at the same URL with an image extension. */
function posterFor(src: string, fallback?: string) {
  return src.includes('res.cloudinary.com') ? src.replace(/\.(mp4|mov|webm)$/i, '.jpg') : fallback
}

/** Videos then images (or the reverse), with a thumbnail strip underneath. */
export default function MediaGallery({ name, videos, images, leadWith = 'videos' }: Props) {
  const videoItems = videos.map(src => ({ type: 'video' as const, src }))
  const imageItems = images.map(src => ({ type: 'image' as const, src }))
  const media = leadWith === 'images' ? [...imageItems, ...videoItems] : [...videoItems, ...imageItems]
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
            poster={posterFor(current.src, images[0])}
            muted
            loop
            playsInline
            autoPlay
            controls
            preload="metadata"
          />
        ) : (
          <img key={current.src} src={current.src} alt={`${name} — photo ${images.indexOf(current.src) + 1}`} />
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
              aria-label={m.type === 'video' ? `Video ${videos.indexOf(m.src) + 1}` : `Photo ${images.indexOf(m.src) + 1}`}
              onClick={() => setIndex(i)}
            >
              {m.type === 'video' ? (
                <>
                  {posterFor(m.src, images[0]) ? <img src={posterFor(m.src, images[0])} alt="" loading="lazy" /> : <video src={m.src} muted preload="metadata" />}
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
