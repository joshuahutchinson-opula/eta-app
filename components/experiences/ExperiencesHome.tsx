// components/experiences/ExperiencesHome.tsx — the Experiences tab's first
// screen: one hero to start planning, your trip (if any), what's on tonight,
// and mood shortcuts. Everything else is a tap away.
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/lib/icons'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import Price from '@/components/Price'
import ErrorState from '@/components/ErrorState'
import { RegionPill } from '@/components/RegionSelector'
import { useRegion } from '@/components/RegionProvider'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { pressable } from '@/lib/pressable'
import type { EventItem } from '@/lib/events'
import type { MoodItem } from '@/lib/plan'
import PlanDiscoverSwitch, { type TabMode } from './PlanDiscoverSwitch'

export interface YourTripRow {
  name: string
  image: string | null
  status: string
  onOpen: () => void
}

const TZ = 'America/Jamaica'

export default function ExperiencesHome({ moods, heroVideo, loading, failed, onRetry, mode, onModeChange, onStart, onSurprise, onMood, surprising, yourTrip }: {
  moods: MoodItem[]
  /** A mood or experience video (with its poster) for the hero. */
  heroVideo: { src: string | null; poster: string } | null
  loading: boolean
  failed: boolean
  onRetry: () => void
  mode: TabMode
  onModeChange: (m: TabMode) => void
  onStart: () => void
  onSurprise: () => void
  onMood: (m: MoodItem) => void
  surprising: boolean
  yourTrip: YourTripRow | null
}) {
  const { t, lang } = useLang()
  const { city, town, ready } = useRegion()
  const locale = lang === 'en' ? 'en-US' : lang
  // Tonight's events in the region; falls back to the next 7 days, else hidden.
  const [events, setEvents] = useState<{ window: 'tonight' | 'week'; list: EventItem[] } | null>(null)

  useEffect(() => {
    if (!ready) return
    let cancelled = false
    const get = (w: 'tonight' | 'week') => fetch(`/api/events?city=${city}&window=${w}&limit=12`).then(r => (r.ok ? r.json() : [])).then(d => (Array.isArray(d) ? d as EventItem[] : [])).catch(() => [])
    ;(async () => {
      const tonight = await get('tonight')
      if (cancelled) return
      if (tonight.length) return setEvents({ window: 'tonight', list: tonight })
      const week = await get('week')
      if (!cancelled) setEvents({ window: 'week', list: week })
    })()
    return () => { cancelled = true }
  }, [city, ready])

  const eventTime = (iso: string, w: 'tonight' | 'week') => {
    const d = new Date(iso)
    const time = d.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: TZ })
    return w === 'tonight' ? time : `${d.toLocaleDateString(locale, { weekday: 'short', timeZone: TZ })} ${time}`
  }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <RegionPill />
        <PlanDiscoverSwitch mode={mode} onChange={onModeChange} />
      </div>

      <h1 style={{ padding: '20px 16px 14px', fontSize: '30px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--label-primary)', lineHeight: 1.1 }}>{t('m.xh.title')}</h1>

      {/* Hero: plan my day */}
      <section style={{ padding: '0 16px' }} aria-label={t('m.xh.planMyDay')}>
        <div style={{ position: 'relative', height: '260px', borderRadius: '20px', overflow: 'hidden', background: 'var(--system-bg-secondary)', boxShadow: 'var(--shadow-card)' }}>
          {heroVideo && (heroVideo.src
            ? <SmartVideo src={heroVideo.src} poster={heroVideo.poster} alt="" />
            : <Img src={heroVideo.poster} alt="" width={1080} height={520} priority />)}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.78) 100%)' }} />
          <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '16px' }}>
            <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '12px' }}>{t('m.xh.planMyDay')}</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); onStart() }} style={{ flex: 1 }}>{t('m.xh.start')}</button>
              <button className="btn btn-secondary" onClick={() => { triggerHaptic('light'); onSurprise() }} disabled={surprising || moods.length === 0} style={{ flex: 1, background: 'rgba(255,255,255,0.92)', color: '#1C1C1E' }}>
                <Icon name="shuffle" size={16} /> {t('m.xh.surprise')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Your trip — only when there is one */}
      {yourTrip && (
        <section style={{ padding: '16px 16px 0' }} aria-label={t('m.xh.yourTrip')}>
          <button onClick={() => { triggerHaptic('light'); yourTrip.onOpen() }} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', width: '100%', border: 'none', textAlign: 'left', fontFamily: 'inherit' }}>
            <span style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: 'var(--rum-tint)', color: 'var(--rum-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {yourTrip.image ? <Img src={yourTrip.image} alt="" width={96} height={96} sizes="48px" /> : <Icon name="route" size={20} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--label-secondary)' }}>{t('m.xh.yourTrip')}</span>
              <span style={{ display: 'block', fontSize: '16px', fontWeight: 700, color: 'var(--label-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{yourTrip.name}</span>
              <span style={{ display: 'block', fontSize: '13px', color: 'var(--rum-text)', fontWeight: 600 }}>{yourTrip.status}</span>
            </span>
            <Icon name="chevronRight" size={14} style={{ color: 'var(--label-tertiary)' }} />
          </button>
        </section>
      )}

      {/* Tonight (or this week) in town — events only */}
      {events && events.list.length > 0 && (
        <section style={{ marginTop: '24px' }}>
          <div className="section-header" style={{ padding: '0 16px' }}>
            <div className="section-heading">
              <span className="section-title">{t(events.window === 'tonight' ? 'm.xh.tonightIn' : 'm.xh.weekIn', { town: town.name })}</span>
            </div>
            <Link href={`/events?when=${events.window}`} className="section-link">{t('m.common.seeAll')}</Link>
          </div>
          <div className="horizontal-scroll" style={{ padding: '0 16px 4px' }}>
            {events.list.map(ev => (
              <Link key={ev.id} href={`/events/${ev.id}`} onClick={() => triggerHaptic('light')} style={{ flexShrink: 0, width: '200px', textDecoration: 'none' }}>
                <div style={{ position: 'relative', height: '130px', borderRadius: '16px', overflow: 'hidden', background: 'var(--system-bg-secondary)' }}>
                  {(ev.imageUrl || ev.vendor?.images?.[0]) && <Img src={(ev.imageUrl || ev.vendor?.images?.[0])!} alt="" width={400} height={260} sizes="200px" />}
                  <span className="num-font" style={{ position: 'absolute', top: '8px', left: '8px', padding: '4px 8px', borderRadius: '999px', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '12px', fontWeight: 700 }}>
                    {eventTime(ev.startAt, events.window)}
                  </span>
                </div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)', marginTop: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</p>
                <p style={{ fontSize: '13px', color: 'var(--label-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ev.venueName} · {ev.isFree || !ev.price ? t('m.xh.free') : <Price usd={ev.price} compact />}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Pick a mood */}
      <section style={{ marginTop: '24px' }}>
        <div className="section-header" style={{ padding: '0 16px' }}>
          <div className="section-heading"><span className="section-title">{t('m.xh.pickMood')}</span></div>
        </div>
        {failed ? (
          <div style={{ padding: '0 16px' }}><ErrorState onRetry={onRetry} /></div>
        ) : loading ? (
          <div className="horizontal-scroll" style={{ padding: '0 16px 4px' }}>
            {[0, 1, 2].map(i => <div key={i} className="skeleton-card" style={{ flexShrink: 0, width: '150px', height: '190px' }}><div className="skeleton-image" style={{ height: '100%' }} /></div>)}
          </div>
        ) : (
          <div className="horizontal-scroll" style={{ padding: '0 16px 4px' }}>
            {moods.map(m => (
              <div
                key={m.id}
                {...pressable(() => { triggerHaptic('light'); onMood(m) })}
                onClick={() => { triggerHaptic('light'); onMood(m) }}
                aria-label={m.name}
                style={{ position: 'relative', flexShrink: 0, width: '150px', height: '190px', borderRadius: '16px', overflow: 'hidden', cursor: 'pointer', background: 'var(--system-bg-secondary)' }}
              >
                {m.videoUrl ? <SmartVideo src={m.videoUrl} poster={m.coverImage} alt="" /> : <Img src={m.coverImage} alt="" width={300} height={380} sizes="150px" />}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 45%, rgba(0,0,0,0.75))' }} />
                <span style={{ position: 'absolute', left: '12px', right: '12px', bottom: '12px', color: 'white', fontSize: '16px', fontWeight: 700, lineHeight: 1.2 }}>{m.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
