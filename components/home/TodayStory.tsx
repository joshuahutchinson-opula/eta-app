// components/home/TodayStory.tsx — Home's Today story (App Store Today
// style): one big editorial card per region per day (lib/home.ts). Tapping
// grows the card's media into the full-screen story (a shared-element
// transition: the same media box animates from the card to the top of the
// screen) with the story in blocks — text, inline photos, quotes — and the
// place/event card at the end (Go / View / Book). Swipe down or × to close;
// it shrinks back into the card. Reduce motion swaps the growth for a fade.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createPortal } from 'react-dom'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import { directionsUrl } from '@/lib/calendar'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { triggerHaptic } from '@/lib/haptics'
import { useReducedMotion } from '@/lib/motion'
import { useOpenLine } from '@/components/home/bits'
import type { TodayStoryView } from '@/lib/home'
import type { DictKey } from '@/lib/i18n'

type Phase = 'closed' | 'opening' | 'open' | 'closing'
type Box = { top: number; left: number; width: number; height: number }

const AUTO_TEMPLATES = ['FOOD', 'DRINKS', 'BEACH', 'ACTIVITY', 'WELLNESS']
const CLOSE_DRAG = 110
const heroHeight = () => Math.min(window.innerHeight * 0.58, 500)

export function useStoryTitle() {
  const { t } = useLang()
  return (s: TodayStoryView) => {
    if (!s.auto || !s.template) return s.title
    const key = `m.today.auto.${AUTO_TEMPLATES.includes(s.template) ? s.template : 'OTHER'}` as DictKey
    return t(key, { name: s.vendor?.name ?? s.title, area: s.vendor?.neighborhood ?? '' })
  }
}

function Media({ story, active, priority }: { story: TodayStoryView; active: boolean; priority?: boolean }) {
  return story.coverVideo
    ? <SmartVideo src={story.coverVideo} poster={story.coverImage} alt="" active={active} />
    : <Img src={story.coverImage} alt="" width={1080} height={1350} sizes="100vw" priority={priority} />
}

export default function TodayStory({ story }: { story: TodayStoryView }) {
  const { t } = useLang()
  const labels = useLabels()
  const openLine = useOpenLine()
  const titleOf = useStoryTitle()
  const reduce = useReducedMotion()
  const cardRef = useRef<HTMLButtonElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ y: number; dy: number } | null>(null)
  const [phase, setPhase] = useState<Phase>('closed')
  const [box, setBox] = useState<Box | null>(null)
  const [dy, setDy] = useState(0)

  const measure = (): Box | null => {
    const r = cardRef.current?.getBoundingClientRect()
    return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null
  }

  const open = () => {
    triggerHaptic('light')
    setBox(measure())
    setDy(0)
    setPhase('opening')
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')))
  }

  const close = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    setBox(measure())
    setDy(0)
    setPhase('closing')
    setTimeout(() => { setPhase('closed'); document.body.style.overflow = '' }, reduce ? 160 : 520)
  }, [reduce])

  useEffect(() => {
    if (phase !== 'open') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, close])

  useEffect(() => () => { document.body.style.overflow = '' }, [])

  // Swipe down (from the top of the story) to close.
  const onTouchStart = (e: React.TouchEvent) => { drag.current = (scrollRef.current?.scrollTop ?? 0) <= 0 ? { y: e.touches[0].clientY, dy: 0 } : null }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current) return
    const d = e.touches[0].clientY - drag.current.y
    if (d <= 0 || (scrollRef.current?.scrollTop ?? 0) > 0) { if (dy) setDy(0); return }
    drag.current.dy = d
    setDy(d)
  }
  const onTouchEnd = () => {
    const d = drag.current?.dy ?? 0
    drag.current = null
    if (d > CLOSE_DRAG) close()
    else setDy(0)
  }

  const title = titleOf(story)
  const eyebrow = story.eyebrow || t('m.today.eyebrow')
  const expanded = phase === 'open'
  const hidden = phase !== 'closed'
  const fullBox = typeof window !== 'undefined' ? { top: 0, left: 0, width: window.innerWidth, height: heroHeight() } : null
  const mediaBox = expanded || (reduce && phase !== 'closed') ? fullBox : box
  const dragK = Math.min(dy, 320) / 320
  const v = story.vendor
  const ev = story.event

  return (
    <>
      <button ref={cardRef} className="today-card press" onClick={open} aria-label={`${eyebrow}: ${title}. ${t('m.today.readStory')}`} aria-expanded={hidden}>
        <div className="today-media" style={{ visibility: hidden ? 'hidden' : 'visible' }}><Media story={story} active={!hidden} /></div>
        <div className="today-shade" />
        <div className="today-text" style={{ top: 0 }}><span className="today-eyebrow">{eyebrow}</span></div>
        <div className="today-text" style={{ bottom: 0 }}>
          <h3 className="today-title">{title}</h3>
          <p className="today-dek">{story.dek}</p>
        </div>
      </button>

      {phase !== 'closed' && mediaBox && createPortal(
        <div className={`story-overlay ${expanded ? 'open' : ''} ${phase === 'closing' ? 'closing' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
          <div className="story-backdrop" style={{ opacity: expanded ? 1 - dragK * 0.6 : undefined }} />
          <div style={{ position: 'absolute', inset: 0, transform: dy ? `translateY(${dy * 0.55}px) scale(${1 - dragK * 0.12})` : undefined, borderRadius: dy ? `${22 * dragK}px` : undefined, transition: dy ? 'none' : 'transform 0.4s var(--spring-standard)', transformOrigin: '50% 30%' }}>
            <div className="story-media" style={{ ...mediaBox, borderRadius: expanded ? 0 : 22, opacity: reduce && !expanded ? 0 : 1 }}>
              <Media story={story} active={expanded} priority />
              <div className="today-shade" style={{ opacity: expanded ? 0.6 : 1, transition: 'opacity 0.4s ease' }} />
              <div className="today-text" style={{ bottom: 26, opacity: expanded ? 1 : 0, transition: 'opacity 0.3s ease 0.2s' }}>
                <span className="today-eyebrow" style={{ display: 'block', marginBottom: '6px' }}>{eyebrow}</span>
                <h2 className="today-title">{title}</h2>
              </div>
            </div>
            <div ref={scrollRef} className="story-scroll" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
              <div style={{ height: fullBox ? fullBox.height - 22 : '55vh' }} onClick={close} aria-hidden />
              <article className="story-content">
                <p style={{ fontSize: '19px', lineHeight: 1.45, fontWeight: 600, color: 'var(--label-primary)', letterSpacing: '-0.01em', marginBottom: '20px' }}>{story.dek}</p>
                <div className="story-body">
                  {story.body.map((b, i) => b.type === 'text' ? <p key={i}>{b.text}</p>
                    : b.type === 'image' ? (
                      <figure key={i}>
                        <Img src={b.url} alt={b.caption ?? ''} width={1080} height={810} sizes="100vw" style={{ height: 'auto' }} />
                        {b.caption && <figcaption>{b.caption}</figcaption>}
                      </figure>
                    ) : (
                      <blockquote key={i}>“{b.text}”{b.by && <cite>— {b.by}</cite>}</blockquote>
                    ))}
                </div>

                {v && (
                  <div className="home-card" style={{ padding: '14px', marginTop: '8px', boxShadow: 'var(--home-shadow)' }}>
                    <p className="home-eyebrow" style={{ marginBottom: '10px' }}>{t('m.today.thePlace')}</p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ width: '64px', height: '64px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)' }}>
                        {v.image && <Img src={v.image} alt="" width={128} height={128} sizes="64px" />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '17px', fontWeight: 800, color: 'var(--label-primary)' }}>{v.name}</span>
                        <span style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{[labels.category(v.category), v.neighborhood, openLine(v.open)].filter(Boolean).join(' · ')}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {directionsUrl(v) && <a href={directionsUrl(v)!} target="_blank" rel="noopener noreferrer" className="btn btn-secondary press" style={{ flex: 1, textDecoration: 'none' }}><Icon name="navigate" size={15} /> {t('m.xd.go')}</a>}
                      <Link href={`/vendor/${v.id}`} onClick={() => { document.body.style.overflow = '' }} className="btn btn-primary press" style={{ flex: 1, textDecoration: 'none' }}>{t('m.common.view')}</Link>
                    </div>
                  </div>
                )}

                {ev && (
                  <div className="home-card" style={{ padding: '14px', marginTop: '12px', boxShadow: 'var(--home-shadow)' }}>
                    <p className="home-eyebrow" style={{ marginBottom: '10px' }}>{t('m.today.theEvent')}</p>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ width: '64px', height: '64px', borderRadius: '14px', overflow: 'hidden', flexShrink: 0, background: 'var(--system-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--label-tertiary)' }}>
                        {ev.imageUrl ? <Img src={ev.imageUrl} alt="" width={128} height={128} sizes="64px" /> : <Icon name="party" size={24} />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '17px', fontWeight: 800, color: 'var(--label-primary)' }}>{ev.title}</span>
                        <span className="num-font" style={{ display: 'block', fontSize: '13px', color: 'var(--label-secondary)' }}>{ev.venueName} · {new Date(ev.startAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' })}</span>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      {directionsUrl(ev) && <a href={directionsUrl(ev)!} target="_blank" rel="noopener noreferrer" className="btn btn-secondary press" style={{ flex: 1, textDecoration: 'none' }}><Icon name="navigate" size={15} /> {t('m.xd.go')}</a>}
                      <Link href={`/events/${ev.id}`} onClick={() => { document.body.style.overflow = '' }} className={`btn ${ev.bookable ? 'btn-secondary' : 'btn-primary'} press`} style={{ flex: 1, textDecoration: 'none' }}>{t('m.common.view')}</Link>
                      {ev.bookable && <Link href={`/events/${ev.id}#tickets`} onClick={() => { document.body.style.overflow = '' }} className="btn btn-primary press" style={{ flex: 1, textDecoration: 'none' }}>{t('m.today.book')}</Link>}
                    </div>
                  </div>
                )}
              </article>
            </div>
          </div>
          <button className="glass-pill glass-icon story-close" onClick={close} aria-label={t('m.today.close')} style={{ background: 'rgba(0,0,0,0.4)' }}>
            <Icon name="close" size={16} />
          </button>
        </div>,
        document.body
      )}
    </>
  )
}
