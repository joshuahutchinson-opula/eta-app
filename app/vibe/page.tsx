// app/vibe/page.tsx — "Watch <town> now": a full-screen vertical swipe feed
// of short videos from the selected region (lib/vibe-feed.ts): vendor
// videos, event promos, approved Instagram mentions and traveler stories,
// the daypart's and open-now places first. Each one: place name, one line
// (category · distance · open till), and Save (heart or double-tap), Go and
// View. Videos play muted (tap for sound); only the current one plays and
// only the next one preloads. Low data mode shows posters; reduce motion
// waits for a tap before playing. Home only links here when the region has
// enough fresh video.
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { useLabels } from '@/lib/labels'
import { useLowData } from '@/lib/low-data'
import { useReducedMotion } from '@/lib/motion'
import { distanceFrom, formatDistance, useUserLocation } from '@/lib/geo'
import { directionsUrl } from '@/lib/calendar'
import { triggerHaptic } from '@/lib/haptics'
import { useOpenLine, useSaved } from '@/components/home/bits'
import type { VibeItem } from '@/lib/vibe-feed'

const DOUBLE_TAP_MS = 260

function Slide({ item, index, total, current, preload, muted, lowData, reduce, onToggleSound }: {
  item: VibeItem; index: number; total: number; current: boolean; preload: boolean; muted: boolean; lowData: boolean; reduce: boolean; onToggleSound: () => void
}) {
  const { t, lang } = useLang()
  const labels = useLabels()
  const openLine = useOpenLine()
  const location = useUserLocation()
  const video = useRef<HTMLVideoElement>(null)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [playing, setPlaying] = useState(false)
  const [bursts, setBursts] = useState<number[]>([])
  const [beat, setBeat] = useState(0)
  const kind = item.target?.kind === 'event' ? 'events' : 'vendors'
  const [saved, toggleSaved] = useSaved(kind, item.target?.id)

  // Only the current slide plays; reduce motion waits for a tap.
  useEffect(() => {
    const el = video.current
    if (!el) return
    el.muted = muted
    if (current && !reduce && document.visibilityState === 'visible') el.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    else if (!current) { el.pause(); setPlaying(false) }
  }, [current, reduce, muted])

  useEffect(() => {
    const onVis = () => { const el = video.current; if (!el) return; if (document.visibilityState !== 'visible') el.pause(); else if (current && (playing || !reduce)) el.play().catch(() => {}) }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [current, playing, reduce])

  const save = () => {
    if (!item.target) return
    if (toggleSaved()) setBeat(b => b + 1)
  }

  const onTap = () => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current)
      tapTimer.current = null
      // Double-tap: always saves (never un-saves).
      if (item.target) {
        if (!saved) save()
        else triggerHaptic('light')
        if (!reduce) setBursts(b => [...b, Date.now()])
      }
      return
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null
      const el = video.current
      if (reduce && el) { if (el.paused) { el.play().then(() => setPlaying(true)).catch(() => {}) } else { el.pause(); setPlaying(false) } return }
      onToggleSound()
    }, DOUBLE_TAP_MS)
  }

  const km = distanceFrom(location, item)
  const when = item.startAt ? t('m.vibe.startsAt', { time: new Date(item.startAt).toLocaleTimeString(lang === 'en' ? 'en-US' : lang, { hour: 'numeric', minute: '2-digit', timeZone: 'America/Jamaica' }) }) : null
  const line = [item.category === 'EVENT' ? t('m.vibe.event') : labels.category(item.category), formatDistance(km), when ?? openLine(item.open)].filter(Boolean).join(' · ')
  const nav = directionsUrl(item)
  const href = item.target ? (item.target.kind === 'event' ? `/events/${item.target.id}` : `/vendor/${item.target.id}`) : null
  const showVideo = !lowData && (current || preload)

  return (
    <section className="vibe-slide" aria-roledescription="slide" aria-label={`${t('m.vibe.slide', { n: index + 1, total })}: ${item.name}`}>
      {item.poster && <Img src={item.poster} alt="" width={1080} height={1920} sizes="100vw" className="vibe-poster" priority={index === 0} />}
      {showVideo && (
        <video ref={video} src={item.src} poster={item.poster ?? undefined} muted={muted} loop playsInline preload="auto" aria-label={item.name} />
      )}
      <div className="vibe-shade" />
      <button onClick={onTap} aria-label={muted ? t('m.vibe.unmute') : t('m.vibe.mute')} style={{ position: 'absolute', inset: 0, background: 'none', border: 'none', cursor: 'pointer' }} />
      {bursts.map(id => <span key={id} className="vibe-burst" onAnimationEnd={() => setBursts(b => b.filter(x => x !== id))}><Icon name="heart" className="filled" size={96} /></span>)}
      {reduce && current && !playing && !lowData && (
        <span aria-hidden style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%, -50%)', width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}><Icon name="play" size={28} /></span>
      )}

      <div className="vibe-info">
        <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1, textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>{item.name}</h2>
        <p className="num-font" style={{ fontSize: '13px', opacity: 0.92, marginTop: '4px' }}>{line}</p>
        {item.by && <p style={{ fontSize: '13px', opacity: 0.75, marginTop: '2px' }}>{t('m.vibe.by', { name: item.by })}</p>}
        {lowData && <p style={{ fontSize: '12px', opacity: 0.7, marginTop: '6px' }}>{t('m.vibe.lowData')}</p>}
      </div>

      <div className="vibe-actions">
        {item.target && (
          <button className="vibe-action" aria-pressed={saved} aria-label={saved ? t('m.home.saved') : t('m.home.save')} onClick={save}>
            <span key={beat} className={beat ? 'heart-beat' : ''} style={{ display: 'inline-flex' }}><Icon name="heart" className={saved ? 'filled' : ''} size={24} /></span>
          </button>
        )}
        {nav && (
          <a className="vibe-action" href={nav} target="_blank" rel="noopener noreferrer" onClick={() => triggerHaptic('light')} aria-label={t('m.xd.go')}>
            <Icon name="navigate" size={20} />{t('m.xd.go')}
          </a>
        )}
        {href && (
          <Link className="vibe-action" href={href} onClick={() => triggerHaptic('light')} aria-label={t('m.common.view')}>
            <Icon name="eye" size={20} />{t('m.common.view')}
          </Link>
        )}
        {!lowData && (
          <button className="vibe-action" onClick={onToggleSound} aria-label={muted ? t('m.vibe.unmute') : t('m.vibe.mute')} aria-pressed={!muted} style={{ width: '44px', height: '44px', opacity: muted ? 0.8 : 1 }}>
            <Icon name="audio" size={18} />
          </button>
        )}
      </div>
    </section>
  )
}

export default function VibeFeedPage() {
  const router = useRouter()
  const { t } = useLang()
  const { city, town, ready } = useRegion()
  const { lowData } = useLowData()
  const reduce = useReducedMotion()
  const feedRef = useRef<HTMLDivElement>(null)
  const [items, setItems] = useState<VibeItem[] | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [index, setIndex] = useState(0)
  const indexRef = useRef(0)
  const [muted, setMuted] = useState(true)
  const [soundHint, setSoundHint] = useState(false)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    fetch(`/api/vibe?city=${city}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('vibe'))))
      .then((d: { enabled: boolean; items: VibeItem[] }) => { if (!cancelled) { setEnabled(d.enabled); setItems(d.items) } })
      .catch(() => { if (!cancelled) { setEnabled(false); setItems([]) } })
    return () => { cancelled = true }
  }, [city, ready])

  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const i = Math.round(el.scrollTop / el.clientHeight)
        if (i !== indexRef.current) { indexRef.current = i; triggerHaptic('selection'); setIndex(i) }
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [items])

  const toggleSound = useCallback(() => {
    setMuted(m => !m)
    setSoundHint(true)
    setTimeout(() => setSoundHint(false), 1200)
  }, [])

  const close = () => (window.history.length > 1 ? router.back() : router.push('/'))

  return (
    <main style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <div ref={feedRef} className="vibe-feed" aria-roledescription="carousel" aria-label={t('m.home.watch', { town: town.name })}>
        {items?.map((item, i) => (
          <Slide key={item.id} item={item} index={i} total={items.length} current={i === index} preload={i === index + 1} muted={muted} lowData={lowData} reduce={reduce} onToggleSound={toggleSound} />
        ))}
        {items && (!enabled || items.length === 0) && (
          <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '24px', textAlign: 'center', color: 'white' }}>
            <Icon name="video" size={36} style={{ opacity: 0.7 }} />
            <p style={{ maxWidth: '300px', opacity: 0.85 }}>{t('m.vibe.empty', { town: town.name })}</p>
            <button className="btn btn-primary" onClick={close}>{t('m.vibe.close')}</button>
          </div>
        )}
        {!items && <div className="vibe-slide" aria-hidden style={{ background: '#111' }} />}
      </div>

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 5, padding: 'calc(env(safe-area-inset-top, 0px) + 10px) 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'none' }}>
        <button className="glass-pill glass-icon" onClick={close} aria-label={t('m.vibe.close')} style={{ pointerEvents: 'auto' }}><Icon name="close" size={16} /></button>
        <span className="glass-pill" style={{ pointerEvents: 'none', minHeight: '32px', fontSize: '13px' }}><Icon name="mapPin" size={12} /> {town.name}</span>
      </div>

      {soundHint && (
        <p role="status" className="glass-pill" style={{ position: 'fixed', left: '50%', top: '40%', transform: 'translateX(-50%)', zIndex: 6 }}>
          <Icon name="audio" size={14} /> {muted ? t('m.vibe.mute') : t('m.vibe.soundOn')}
        </p>
      )}
    </main>
  )
}
