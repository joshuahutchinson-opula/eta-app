// components/web/FeaturedCarousel.tsx
// Web version of mobile Home's Featured carousel: same vendors in the same
// order, videos autoplay, auto-advance every 5s, and the same pause rule —
// while a touch/press is held anywhere on the page it stops, then resumes
// on release. On desktop it also pauses while hovered or focused, so it
// never moves out from under a pointer or keyboard user.
//
// Videos are fitted (object-fit: contain), never cropped; a blurred copy of
// the vendor's photo fills any letterbox space behind them. That backdrop
// and the caption are parallax layers (see ParallaxScope) — the video itself
// stays pinned to the frame so nothing is ever cut off.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/i18n-client'
import { CATEGORY_LABELS } from '@/lib/vendor-types'
import { areaLabel } from '@/lib/areas'

export interface FeaturedVendor {
  id: string
  name: string
  category: string
  area: string
  video: string
  image: string | null
  live: boolean
  whoThere: number
}

const INTERVAL_MS = 5000

export default function FeaturedCarousel({ vendors }: { vendors: FeaturedVendor[] }) {
  const { t } = useLang()
  const [index, setIndex] = useState(0)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLElement>(null)
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([])
  const pressingRef = useRef(false)
  const hoverRef = useRef(false)

  const goTo = useCallback((i: number, smooth = true) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? 'smooth' : 'auto' })
    setIndex(i)
  }, [])

  // Pause while a touch or mouse press is held anywhere on the page (mobile parity).
  useEffect(() => {
    const down = () => { pressingRef.current = true }
    const up = () => { pressingRef.current = false }
    document.addEventListener('pointerdown', down, { passive: true })
    document.addEventListener('pointerup', up, { passive: true })
    document.addEventListener('pointercancel', up, { passive: true })
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', up)
    }
  }, [])

  useEffect(() => {
    if (vendors.length <= 1) return
    const timer = setInterval(() => {
      if (pressingRef.current || hoverRef.current || document.hidden) return
      setIndex(prev => {
        const next = (prev + 1) % vendors.length
        const el = scrollerRef.current
        if (el) el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
        return next
      })
    }, INTERVAL_MS)
    return () => clearInterval(timer)
  }, [vendors.length])

  // Only the visible slide's video plays.
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return
      if (i === index) {
        v.muted = true
        v.play().catch(() => {})
      } else {
        v.pause()
      }
    })
  }, [index])

  const onScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index) setIndex(Math.min(Math.max(i, 0), vendors.length - 1))
  }

  if (vendors.length === 0) return null

  return (
    <section
      ref={rootRef}
      className="w-featured"
      aria-roledescription="carousel"
      aria-label={t('home.featured')}
      onMouseEnter={() => { hoverRef.current = true }}
      onMouseLeave={() => { hoverRef.current = false }}
      onFocus={() => { hoverRef.current = true }}
      onBlur={() => { hoverRef.current = false }}
    >
      <div className="w-featured-track" ref={scrollerRef} onScroll={onScroll}>
        {vendors.map((v, i) => (
          <Link
            key={v.id}
            href={`/web/vendor/${v.id}`}
            className="w-featured-slide"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${vendors.length}: ${v.name}`}
            tabIndex={i === index ? 0 : -1}
          >
            <div
              className="w-featured-backdrop"
              data-parallax="0.22"
              data-parallax-max="80"
              aria-hidden
              style={v.image ? { backgroundImage: `url("${v.image}")` } : undefined}
            />
            <div className="w-featured-media">
              <video
                ref={el => { videoRefs.current[i] = el }}
                src={v.video}
                poster={v.image ?? undefined}
                muted
                loop
                playsInline
                preload={i === index || i === (index + 1) % vendors.length ? 'auto' : 'metadata'}
              />
            </div>
            <div className="w-featured-body" data-parallax="-0.06" data-parallax-max="28">
              {v.live ? (
                <span className="w-pill w-featured-live"><span className="w-dot w-dot-live" /> {v.whoThere} {t('common.hereNow')}</span>
              ) : null}
              <h2 className="w-featured-title">{v.name}</h2>
              <p className="w-featured-meta">{CATEGORY_LABELS[v.category] ?? v.category} · {areaLabel(v.area)}</p>
            </div>
          </Link>
        ))}
      </div>
      {vendors.length > 1 ? (
        <div className="w-featured-dots" role="tablist" aria-label={t('home.featured')}>
          {vendors.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={v.name}
              className={`w-featured-dot ${i === index ? 'active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
