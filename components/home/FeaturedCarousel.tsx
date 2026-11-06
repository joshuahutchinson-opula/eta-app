// components/home/FeaturedCarousel.tsx — Home's Featured: one large
// swipeable carousel of B.O.N and promoted places for the daypart (open now
// or soon; lib/home.ts). Cards tilt slightly and their media drifts as they
// scroll (CSS vars --o/--a set per frame), only the centred card's video
// plays, and promoted ones say "Promoted". A green "Open" or amber "Closes
// in 40 min" dot shows where it stands; long-press opens the quick preview
// (components/home/QuickPreview). Reduce motion keeps them flat.
'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { triggerHaptic } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/motion'
import { SaveHeart, useOpenLine } from '@/components/home/bits'
import { useLongPress } from '@/components/home/QuickPreview'
import type { FeaturedItem } from '@/lib/home'

function OpenDot({ v }: { v: FeaturedItem }) {
  const { t } = useLang()
  if (v.open.state === 'open') {
    return v.closesInMin !== null
      ? <span className="open-dot amber"><span aria-hidden /> {t('m.feat.closesIn', { n: v.closesInMin })}</span>
      : <span className="open-dot green"><span aria-hidden /> {t('common.open')}</span>
  }
  if (v.open.state === 'soon') return <span className="open-dot amber"><span aria-hidden /> {t('m.feat.opensSoon')}</span>
  return null
}

function Slide({ v, i, count, active, onPreview }: { v: FeaturedItem; i: number; count: number; active: boolean; onPreview?: (v: FeaturedItem) => void }) {
  const { t } = useLang()
  const labels = useLabels()
  const openLine = useOpenLine()
  const press = useLongPress(() => onPreview?.(v))
  return (
    <div className="featured-slide" aria-roledescription="slide" aria-label={`${i + 1} / ${count}: ${v.name}`}>
      <Link href={`/vendor/${v.id}`} onClick={() => triggerHaptic('light')} className="featured-card" {...(onPreview ? press : {})}>
        <div className="featured-media">
          {v.video ? <SmartVideo src={v.video} poster={v.image} alt={v.name} active={active} />
            : v.image ? <Img src={v.image} alt={v.name} width={1080} height={1350} sizes="90vw" priority={i === 0} /> : null}
        </div>
        <div className="featured-shade" />
        <div style={{ position: 'absolute', top: '14px', left: '14px', right: '14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {v.promoted && <span className="tag-pill tag-light">{t('m.home.promoted')}</span>}
            {v.bon && <span className="tag-pill tag-gold">★ B.O.N</span>}
            {v.live && <span className="tag-pill tag-light"><span className="live-dot" /><span className="num-font">{v.whoThere}</span> {t('m.home.hereNow')}</span>}
          </div>
          <SaveHeart kind="vendors" id={v.id} />
        </div>
        <div className="featured-body">
          <OpenDot v={v} />
          <h3 className="featured-name">{v.name}</h3>
          <p className="featured-meta">{[labels.category(v.category), v.neighborhood, v.minutesFromPort !== undefined ? t('m.cruise.fromPort', { n: v.minutesFromPort }) : openLine(v.open)].filter(Boolean).join(' · ')}</p>
        </div>
      </Link>
    </div>
  )
}

export default function FeaturedCarousel({ items, onPreview }: { items: FeaturedItem[]; onPreview?: (v: FeaturedItem) => void }) {
  const { t } = useLang()
  const reduce = useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)

  useEffect(() => {
    const el = track.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let bestD = Infinity
      Array.from(el.children).forEach((child, i) => {
        const c = child as HTMLElement
        const center = c.offsetLeft + c.offsetWidth / 2
        const o = Math.max(-1, Math.min(1, (center - mid) / c.offsetWidth))
        if (Math.abs(o) < bestD) { bestD = Math.abs(o); best = i }
        if (!reduce) {
          c.style.setProperty('--o', o.toFixed(3))
          c.style.setProperty('--a', Math.abs(o).toFixed(3))
        }
      })
      if (indexRef.current !== best) {
        indexRef.current = best
        triggerHaptic('selection')
        setIndex(best)
      }
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update) }
    update()
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [items, reduce])

  useEffect(() => { track.current?.scrollTo({ left: 0 }); indexRef.current = 0; setIndex(0) }, [items])

  return (
    <>
      <div ref={track} className="home-carousel" aria-roledescription="carousel" aria-label={t('m.home.destinations')}>
        {items.map((v, i) => <Slide key={v.id} v={v} i={i} count={items.length} active={i === index} onPreview={onPreview} />)}
      </div>
      {items.length > 1 && <div className="dots" aria-hidden>{items.map((_, i) => <span key={i} className={i === index ? 'on' : ''} />)}</div>}
    </>
  )
}
