// components/experiences/ResultsCarousel.tsx — "Your day, three ways": one
// big option card at a time (swipe, arrows or dots), each with its photo,
// route map, one reason it fits and one meta line.
'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import Price from '@/components/Price'
import BackButton from '@/components/BackButton'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { BADGE_LABEL, type OptionBadge } from '@/lib/plan'
import type { RouteMapStop } from '@/components/RouteMap'

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false })

export interface ResultOption {
  id: string
  name: string
  tagline: string
  image: string
  badge: OptionBadge | null
  stops: RouteMapStop[]
  why: string | null
  duration: string | null
  price: number
  pts: number | null
}

export default function ResultsCarousel({ eyebrow, options, notice, fallbackCenter, busy, error, onBack, onCrewVote, onSeeRoute, onRetry }: {
  eyebrow: string
  options: ResultOption[]
  /** e.g. "Couldn't build fresh routes — here are curated ones." */
  notice: string | null
  fallbackCenter: [number, number]
  busy: boolean
  error: string | null
  onBack: () => void
  onCrewVote: (o: ResultOption) => void
  onSeeRoute: (o: ResultOption) => void
  onRetry: () => void
}) {
  const { t } = useLang()
  const track = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const current = options[Math.min(index, Math.max(0, options.length - 1))]
  const title = t(options.length === 3 ? 'm.res.title3' : 'm.res.titleAny')

  useEffect(() => { setIndex(0); track.current?.scrollTo({ left: 0 }) }, [options])

  const go = (i: number) => {
    const el = track.current
    if (!el || i < 0 || i >= options.length) return
    triggerHaptic('selection')
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }
  const onScroll = () => {
    const el = track.current
    if (!el || !el.clientWidth) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== index) setIndex(i)
  }

  const arrow = (dir: -1 | 1) => (
    <button className="back-button" onClick={() => go(index + dir)} disabled={dir < 0 ? index === 0 : index >= options.length - 1} aria-label={t(dir < 0 ? 'm.res.prev' : 'm.res.next')} style={{ opacity: (dir < 0 ? index === 0 : index >= options.length - 1) ? 0.35 : 1 }}>
      <Icon name={dir < 0 ? 'back' : 'chevronRight'} size={16} />
    </button>
  )

  return (
    <main className="screen-push-in" style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: 'calc(96px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0' }}>
        <BackButton onClick={onBack} />
        <p className="section-eyebrow" style={{ display: 'block', marginTop: '16px' }}>{eyebrow}</p>
        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--label-primary)', marginTop: '2px' }}>{title}</h1>
        {notice && <p role="status" style={{ fontSize: '13px', color: 'var(--label-secondary)', marginTop: '6px' }}>{notice}</p>}
      </div>

      {options.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '24px' }}>
          <Icon name="search" size={32} style={{ color: 'var(--label-tertiary)' }} />
          <p style={{ fontSize: '17px', fontWeight: 600 }}>{t('m.exp.noMatch')}</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button className="btn btn-secondary" onClick={onBack}>{t('m.exp.tryVibes')}</button>
            <button className="btn btn-primary" onClick={onRetry}>{t('m.res.again')}</button>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={track}
            onScroll={onScroll}
            className="snap-carousel"
            aria-roledescription="carousel"
            aria-label={title}
            style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', marginTop: '16px' }}
          >
            {options.map((o, i) => (
              <section
                key={o.id}
                aria-roledescription="slide"
                aria-label={t('m.res.nOfM', { n: i + 1, total: options.length })}
                style={{ flex: '0 0 100%', scrollSnapAlign: 'center', padding: '0 16px', boxSizing: 'border-box' }}
              >
                <div className="card" style={{ cursor: 'default', overflow: 'hidden' }}>
                  <div style={{ position: 'relative', height: '220px' }}>
                    {o.image ? <Img src={o.image} alt="" width={1080} height={440} priority={i === 0} /> : <div style={{ position: 'absolute', inset: 0, background: 'var(--system-bg-secondary)' }} />}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 35%, rgba(0,0,0,0.8) 100%)' }} />
                    {o.badge && (
                      <span style={{ position: 'absolute', top: '12px', left: '12px', background: 'var(--rum)', color: 'white', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px' }}>{t(BADGE_LABEL[o.badge])}</span>
                    )}
                    <span className="num-font" style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.55)', color: 'white', fontSize: '12px', fontWeight: 700, padding: '4px 10px', borderRadius: '999px' }}>
                      {t('m.res.nOfM', { n: i + 1, total: options.length })}
                    </span>
                    <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '14px', color: 'white' }}>
                      <h2 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.01em' }}>{o.name}</h2>
                      <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.85)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.tagline}</p>
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: '150px', background: 'var(--system-bg-secondary)' }}>
                    {Math.abs(i - index) <= 1 && <RouteMap stops={o.stops} fallbackCenter={fallbackCenter} label={t('m.exp.stops', { n: o.stops.length })} />}
                  </div>
                  <div style={{ padding: '14px 16px 16px' }}>
                    {o.why && (
                      <p style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '15px', fontWeight: 600, color: 'var(--label-primary)', lineHeight: 1.35 }}>
                        <Icon name="sparkle" size={16} style={{ color: 'var(--rum-text)', flexShrink: 0, marginTop: '2px' }} />
                        {o.why}
                      </p>
                    )}
                    <p className="num-font" style={{ fontSize: '14px', color: 'var(--label-secondary)', marginTop: o.why ? '8px' : 0 }}>
                      {o.duration && <>{o.duration} · </>}
                      <Price usd={o.price} compact /> {t('m.res.pp')}
                      {o.pts ? <> · <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{t('m.onb.pts', { n: o.pts })}</span></> : null}
                    </p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {options.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', marginTop: '14px' }}>
              {arrow(-1)}
              <div style={{ display: 'flex', gap: '6px' }}>
                {options.map((o, i) => (
                  <button key={o.id} onClick={() => go(i)} aria-label={t('m.res.nOfM', { n: i + 1, total: options.length })} aria-current={i === index} style={{ width: i === index ? '20px' : '8px', height: '8px', borderRadius: '999px', border: 'none', padding: 0, cursor: 'pointer', background: i === index ? 'var(--rum)' : 'var(--separator)', transition: 'width 0.2s ease' }} />
                ))}
              </div>
              {arrow(1)}
            </div>
          )}

          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, background: 'var(--system-bg-elevated)', borderTop: '0.5px solid var(--separator)', padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))', boxShadow: 'var(--shadow-sheet)' }}>
            {error && <p role="alert" style={{ fontSize: '13px', color: 'var(--error)', marginBottom: '8px' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => current && onCrewVote(current)} disabled={busy || !current} style={{ flex: 1 }}>
                <Icon name="users" size={16} /> {busy ? '…' : t('m.res.crewVote')}
              </button>
              <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); if (current) onSeeRoute(current) }} disabled={!current} style={{ flex: 1 }}>
                {t('m.res.seeRoute')}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
