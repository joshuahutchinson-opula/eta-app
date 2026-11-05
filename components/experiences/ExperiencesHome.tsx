// components/experiences/ExperiencesHome.tsx — the Experiences tab's first
// screen: one hero to start planning, the trip days left to plan (trip
// mode), your trip (if any), Parties & Happenings, and mood shortcuts.
// Everything else is a tap away.
'use client'

import Icon from '@/lib/icons'
import Img from '@/components/Img'
import SmartVideo from '@/components/SmartVideo'
import ErrorState from '@/components/ErrorState'
import PartiesHappenings from '@/components/PartiesHappenings'
import { useLang } from '@/lib/i18n-client'
import { triggerHaptic } from '@/lib/haptics'
import { pressable } from '@/lib/pressable'
import { setPlanDay, useTripMode } from '@/lib/trip-mode'
import { jamaicaDayKey } from '@/lib/trip-dates'
import type { MoodItem } from '@/lib/plan'
import PlanDiscoverSwitch, { type TabMode } from './PlanDiscoverSwitch'

export interface YourTripRow {
  name: string
  image: string | null
  status: string
  onOpen: () => void
}

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
  const { progress, daysLeft } = useTripMode()
  const locale = lang === 'en' ? 'en-US' : lang
  const today = jamaicaDayKey()
  const dayLabel = (d: string) => d === today ? t('m.trip.today') : new Date(`${d}T12:00:00-05:00`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', timeZone: 'America/Jamaica' })
  const planDay = (d: string) => { triggerHaptic('light'); setPlanDay(d); onStart() }

  return (
    <main style={{ minHeight: '100dvh', background: 'var(--system-bg)', paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
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
              <button className="btn btn-primary" onClick={() => { triggerHaptic('light'); setPlanDay(null); onStart() }} style={{ flex: 1 }}>{t('m.xh.start')}</button>
              <button className="btn btn-secondary" onClick={() => { triggerHaptic('light'); onSurprise() }} disabled={surprising || moods.length === 0} style={{ flex: 1, background: 'rgba(255,255,255,0.92)', color: '#1C1C1E' }}>
                <Icon name="shuffle" size={16} /> {t('m.xh.surprise')}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trip mode: the days left, each a tap away from planning it */}
      {progress && progress.phase !== 'after' && daysLeft.length > 0 && (
        <section style={{ marginTop: '20px' }} aria-label={t('m.trip.planDays')}>
          <div className="section-header" style={{ padding: '0 16px' }}>
            <div className="section-heading">
              <span className="section-eyebrow">{progress.phase === 'during' ? t('m.trip.dayOf', { day: progress.day, total: progress.total }) : t('m.trip.startsIn', { n: progress.daysUntil })}</span>
              <span className="section-title">{t('m.trip.daysLeft', { n: daysLeft.length })}</span>
            </div>
          </div>
          <div className="horizontal-scroll" style={{ padding: '0 16px 4px', gap: '8px' }}>
            {daysLeft.map((d, i) => (
              <button key={d} onClick={() => planDay(d)} className="card" style={{ flexShrink: 0, border: 'none', fontFamily: 'inherit', padding: '10px 14px', textAlign: 'left', minWidth: '96px', cursor: 'pointer' }}>
                <span className="num-font" style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--rum-text)' }}>{t('m.trip.dayN', { n: progress.total - daysLeft.length + i + 1 })}</span>
                <span style={{ display: 'block', fontSize: '15px', fontWeight: 700, color: 'var(--label-primary)' }}>{dayLabel(d)}</span>
                <span style={{ display: 'block', fontSize: '12px', color: 'var(--label-secondary)' }}>{t('m.trip.planIt')}</span>
              </button>
            ))}
          </div>
        </section>
      )}

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

      <PartiesHappenings />

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
